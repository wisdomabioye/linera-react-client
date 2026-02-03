/**
 * Linera Client Manager
 *
 * Manages the lifecycle of Linera client instances, handling:
 * - Read-only mode with temporary wallets (guest)
 * - Full mode with MetaMask wallets (authenticated)
 * - Wallet switching and chain claiming
 */

import type {
  Client,
  Wallet,
  Signer,
  Faucet,
  Application,
  Chain,
} from '@linera/client';

import {
  ClientMode,
  ClientState,
  ClientConfig,
  LineraModule,
  ApplicationClient,
  ChainApp,
  StateChangeCallback,
  ILineraClientManager,
} from './types';
import { TemporarySigner, PrivateKey, Composite } from '../signers';
import { ApplicationClientImpl, ChainApplicationClient } from './application-client';
import { logger } from '../../utils/logger';

type SignerWithAddress = Signer & {address: () => Promise<string>}

/**
 * Main client manager implementation
 */
export class LineraClientManager implements ILineraClientManager {
  // Public chain resources (temporary signer, always available after initialization)
  private publicClient: Client | null = null;
  private publicWallet: Wallet | null = null;
  private publicAutosigner: PrivateKey | null = null;
  private publicChainId: string | null = null;
  private publicAddress: string | null = null;

  // Wallet chain resources (MetaMask signer, only when wallet connected)
  private walletClient: Client | null = null;
  private walletWallet: Wallet | null = null;
  private walletSigner: SignerWithAddress | null = null;
  private walletAutosigner: PrivateKey | null = null;
  private walletChainId: string | null = null;
  private walletAddress: string | null = null;

  private mode: ClientMode = ClientMode.UNINITIALIZED;
  private config: ClientConfig;
  private stateListeners: Set<StateChangeCallback> = new Set();
  private lineraModule: LineraModule | null = null;
  private faucet: Faucet | null = null;

  // ============================================
  // CACHE LAYER
  // ============================================
  private chainCache: Map<string, Chain> = new Map();
  private appCache: Map<string, ApplicationClient> = new Map();
  private cachedWalletChain: Chain | null = null;
  private readonly MAX_CACHED_CHAINS = 10;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  /**
   * Get current client state
   */
  getState(): ClientState {
    return {
      mode: this.mode,
      isInitialized: this.mode !== ClientMode.UNINITIALIZED,
      hasWallet: this.mode === ClientMode.FULL,
      walletAddress: this.walletAddress || undefined,
      publicAddress: this.publicAddress || undefined,
      publicChainId: this.publicChainId || undefined,
      walletChainId: this.walletChainId || undefined,
      faucetUrl: this.config.faucetUrl,
    };
  }

  /**
   * Get public client (for queries and system operations)
   */
  getPublicClient(): Client | null {
    return this.publicClient;
  }

  /**
   * Get wallet client (for user mutations)
   */
  getWalletClient(): Client | null {
    return this.walletClient;
  }

  /**
   * Get wallet instance (returns wallet wallet if available, otherwise public wallet)
   */
  getWallet(): Wallet | null {
    return this.walletWallet || this.publicWallet;
  }

  /**
   * Initialize in read-only mode with temporary wallet
   * Claims a PUBLIC chain for queries and cross-chain subscriptions
   */
  async initializeReadOnly(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Linera client can only be initialized on the client side');
    }

    if (this.mode !== ClientMode.UNINITIALIZED) {
      logger.debug('[ClientManager] Already initialized');
      return;
    }

    try {
      logger.info('[ClientManager] Initializing read-only mode...');

      // Load Linera module
      this.lineraModule = await this.loadLinera();
      const { Client, Faucet, default: init } = this.lineraModule;
      
      // Initialize WASM
      await init();
      // Create faucet
      this.faucet = new Faucet(this.config.faucetUrl);

      if (!this.faucet) {
        logger.error('[ClientManager] Failed to instantiate Faucet');
        throw new Error('[ClientManager] Failed to instantiate Faucet');
      }

      // Create public wallet from faucet
      this.publicWallet = await this.faucet.createWallet();

      // Create temporary signer for public chain
      const tempSigner = new TemporarySigner(this.config.readOnlyWallet);

      // Get temporary address
      const tempOwner = await tempSigner.address();
      this.publicAddress = tempOwner;

      // Create autosigner for automatic inbox processing
      this.publicAutosigner = PrivateKey.createRandom();
      const compositeSigner = new Composite(this.publicAutosigner, tempSigner);

      // Claim PUBLIC chain for queries and subscriptions
      logger.info('[ClientManager] Claiming public chain for queries/subscriptions...');
      this.publicChainId = await this.faucet.claimChain(this.publicWallet, tempOwner);
      logger.info('[ClientManager] Public chain claimed:', this.publicChainId);

      // Create public client with composite signer
      // Note: Client constructor may return a Promise in WASM environment
     
      const clientInstance = new Client(
        this.publicWallet,
        compositeSigner,
        {
          ...this.config.init
        }
      );
      this.publicClient = await Promise.resolve(clientInstance);

      // Enable autosigning: register the autosigner as a chain owner
      // and set it as default so inbox processing happens automatically
      const publicChain = await this.publicClient.chain(this.publicChainId);
      await publicChain.addOwner(this.publicAutosigner.address());
      await this.publicWallet.setOwner(this.publicChainId, this.publicAutosigner.address());

      this.mode = ClientMode.READ_ONLY;
      this.notifyStateChange();

      logger.info('[ClientManager] Read-only mode and system mutation initialized successfully');
      logger.info('[ClientManager] Public chain available for queries and subscriptions');
    } catch (error) {
      this.mode = ClientMode.UNINITIALIZED;
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to initialize read-only client: ${err.message}`);
    }
  }

  /**
   * Connect MetaMask wallet (claims WALLET chain for user mutations)
   * Public chain remains active for queries and subscriptions
   */
  async connectWallet(metamaskSigner: SignerWithAddress): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection only available on client side');
    }

    try {
      logger.info('[ClientManager] Connecting wallet...');

      // Ensure we're initialized (public chain exists)
      if (this.mode === ClientMode.UNINITIALIZED) {
        await this.initializeReadOnly();
      }

      // Get MetaMask address
      const owner = await metamaskSigner.address();
      logger.info('[ClientManager] MetaMask address:', owner);

      // Check if same wallet already connected
      const isSameWallet = this.walletAddress?.toLowerCase() === owner.toLowerCase();

      if (isSameWallet && this.walletChainId && this.walletClient) {
        logger.info('[ClientManager] Same wallet already connected, reusing wallet chain:', this.walletChainId);

        // Only update and notify if signer actually changed
        const signerChanged = this.walletSigner !== metamaskSigner;

        if (signerChanged) {
          this.walletSigner = metamaskSigner;
          this.mode = ClientMode.FULL;
          this.notifyStateChange();
        }

        return;
      }

      // Cleanup old wallet client if switching wallets
      if (this.walletClient) {
        (this.walletClient).free();
        this.walletClient = null;
      }
      if (this.walletWallet) {
        this.walletWallet.free();
        this.walletWallet = null;
      }

      const { Faucet, default: init } = this.lineraModule as LineraModule;

      // Create wallet wallet from faucet
      if (!this.faucet) {
        await init();
        this.faucet = new Faucet(this.config.faucetUrl);
      }

      this.walletWallet = await this.faucet!.createWallet();

      // Claim WALLET chain for user mutations
      logger.info('[ClientManager] Claiming wallet chain for user mutations...');
      this.walletChainId = await this.faucet!.claimChain(this.walletWallet, owner);
      logger.info('[ClientManager] Wallet chain claimed:', this.walletChainId);

      // Update wallet state
      this.walletSigner = metamaskSigner;
      this.walletAddress = owner;

      // Create autosigner for automatic inbox processing
      this.walletAutosigner = PrivateKey.createRandom();
      const compositeSigner = new Composite(this.walletAutosigner, metamaskSigner);

      // Create wallet client with composite signer
      const { Client } = this.lineraModule as LineraModule;

      // Note: Client constructor may return a Promise in WASM environment
      const clientInstance = new Client(
        this.walletWallet as Wallet,
        compositeSigner,
        {
          ...this.config.init
        }
      );
      this.walletClient = await Promise.resolve(clientInstance);

      // Enable autosigning: register the autosigner as a chain owner
      // and set it as default so inbox processing happens automatically
      const walletChain = await this.walletClient.chain(this.walletChainId!);
      await walletChain.addOwner(this.walletAutosigner.address());
      await this.walletWallet!.setOwner(this.walletChainId!, this.walletAutosigner.address());

      // Invalidate application cache BEFORE notifying state change
      // This prevents race conditions where listeners receive stale cached data
      this.invalidateAppCache();

      this.mode = ClientMode.FULL;
      this.notifyStateChange();

      logger.info('[ClientManager] Wallet connected successfully');
      logger.info('[ClientManager] Public chain (queries/subscriptions):', this.publicChainId);
      logger.info('[ClientManager] Wallet chain (user mutations):', this.walletChainId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to connect wallet: ${err.message}`);
    }
  }

  /**
   * Disconnect wallet (remove wallet chain, keep public chain active)
   */
  async disconnectWallet(): Promise<void> {
    if (this.mode !== ClientMode.FULL) {
      logger.debug('[ClientManager] No wallet to disconnect');
      return;
    }

    logger.info('[ClientManager] Disconnecting wallet...');

    // Cleanup ONLY wallet chain resources (keep public chain!)
    if (this.walletClient) {
      (this.walletClient).free();
    }
    if (this.walletWallet) {
      this.walletWallet.free();
    }

    // Clear ONLY wallet state
    this.walletClient = null;
    this.walletWallet = null;
    this.walletSigner = null;
    this.walletAutosigner = null;
    this.walletChainId = null;
    this.walletAddress = null;

    // Public chain resources remain UNTOUCHED
    // this.publicClient - still active
    // this.publicWallet - still active
    // this.publicChainId - still active

    // Invalidate application cache BEFORE notifying state change
    // This prevents race conditions where listeners receive stale cached data
    this.invalidateAppCache();

    // Revert to READ_ONLY mode (public chain still active)
    this.mode = ClientMode.READ_ONLY;
    this.notifyStateChange();

    logger.info('[ClientManager] Wallet disconnected');
    logger.info('[ClientManager] Public chain still active:', this.publicChainId);
  }

  /**
   * Switch to different MetaMask wallet
   */
  async switchWallet(newSigner: SignerWithAddress): Promise<void> {
    logger.info('[ClientManager] Switching wallet...');
    await this.connectWallet(newSigner);
  }

  /**
   * Get application client interface with dual-chain support
   * Uses efficient two-tier caching (application + chain)
   *
   * @param appId - Application ID
   * @returns ApplicationClient with public and wallet access
   */
  async getApplication(appId: string): Promise<ApplicationClient | null> {
    // Guard against empty/invalid appId
    if (!appId || !appId.trim()) {
      logger.warn('[ClientManager] Invalid appId provided (empty or whitespace)');
      return null;
    }

    if (!this.publicClient) {
      logger.warn('[ClientManager] Client not initialized');
      return null;
    }

    // Check application cache first (fast path)
    const cached = this.appCache.get(appId);
    if (cached) {
      logger.debug(`[ClientManager] Application cache hit: ${appId}`);
      return cached;
    }

    // Cache miss - create new application client
    logger.debug(`[ClientManager] Application cache miss: ${appId}, creating...`);

    try {
      if (!this.publicChainId) {
        throw new Error('Public chain not initialized');
      }

      // Get application instance from public chain (uses chain cache)
      const publicChain = await this.getChain(this.publicChainId);
      const publicApp = await publicChain.application(appId);

      // Get application instance from wallet chain if available (uses chain cache)
      let walletApp: Application | undefined;
      if (this.walletClient && this.walletChainId) {
        const walletChain = await this.getWalletChain();
        walletApp = await walletChain.application(appId);
      }

      const appClient = new ApplicationClientImpl(
        appId,
        publicApp,
        walletApp,
        this.mode === ClientMode.FULL,
        this.config.faucetUrl,
        this.publicChainId,
        this.walletChainId || undefined,
        this.walletAddress || undefined,
        this.publicAddress || undefined,
      );

      // Cache the application client
      this.appCache.set(appId, appClient);
      logger.debug(`[ClientManager] Application cached: ${appId} (total: ${this.appCache.size})`);

      return appClient;
    } catch (error) {
      logger.error('[ClientManager] Failed to get application:', error);
      return null;
    }
  }

  /**
   * Check if client can perform write operations
   */
  canWrite(): boolean {
    return this.mode === ClientMode.FULL;
  }

  /**
   * Get chain instance (uses publicClient, explicit chainId required)
   * Implements efficient caching with LRU eviction
   *
   * @param chainId - Explicit chain ID (required, no defaults)
   * @returns Chain instance from cache or newly created
   */
  async getChain(chainId: string): Promise<Chain> {
    if (!this.publicClient) {
      throw new Error('[ClientManager] Public client not initialized. Call initializeReadOnly() first.');
    }

    // Check cache first
    const cached = this.chainCache.get(chainId);
    if (cached) {
      logger.debug(`[ClientManager] Chain cache hit: ${chainId}`);
      return cached;
    }

    // Cache miss - create via publicClient
    logger.debug(`[ClientManager] Chain cache miss: ${chainId}, creating...`);
    const chain = await this.publicClient.chain(chainId);

    // Evict oldest if cache is full (LRU)
    if (this.chainCache.size >= this.MAX_CACHED_CHAINS) {
      this.evictOldestChain();
    }

    // Cache the chain
    this.chainCache.set(chainId, chain);
    logger.debug(`[ClientManager] Chain cached: ${chainId} (total: ${this.chainCache.size})`);

    return chain;
  }

  /**
   * Get application client for a specific chain
   * Returns a ChainApp interface similar to WalletApp
   * Leverages existing chain cache for efficiency
   *
   * @param chainId - Chain ID to load application from
   * @param appId - Application ID
   * @returns ChainApp interface with query, mutate, getAddress, getChainId methods
   *
   * @example
   * ```typescript
   * // Get application from a specific chain
   * const chainApp = await client.getChainApplication(
   *   "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65",
   *   "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000"
   * );
   *
   * // Use like WalletApp
   * const result = await chainApp.query('{ myQuery }');
   * await chainApp.mutate('{ myMutation }');
   * const address = chainApp.getAddress();
   * const chainId = chainApp.getChainId();
   * ```
   */
  async getChainApplication(chainId: string, appId: string): Promise<ChainApp | null> {
    if (!this.publicClient) {
      logger.warn('[ClientManager] Client not initialized');
      return null;
    }

    try {
      // Get chain instance (uses existing chain cache)
      const chain = await this.getChain(chainId);

      // Get application from the chain
      const app = await chain.application(appId);

      // Get chain owner address (use public address as fallback)
      const address = this.publicAddress || 'unknown';

      // Create and return wrapped client (lightweight wrapper, no caching needed)
      return new ChainApplicationClient(appId, app, chainId, address);
    } catch (error) {
      logger.error('[ClientManager] Failed to get chain application:', error);
      return null;
    }
  }

  /**
   * Get wallet chain instance (uses walletClient with caching)
   *
   * @returns Cached wallet chain instance
   * @throws Error if wallet client or wallet chain ID is not available
   */
  private async getWalletChain(): Promise<Chain> {
    if (!this.walletClient || !this.walletChainId) {
      throw new Error('[ClientManager] Wallet client not initialized. Connect wallet first.');
    }

    // Return cached wallet chain if available
    if (this.cachedWalletChain) {
      logger.debug(`[ClientManager] Wallet chain cache hit: ${this.walletChainId}`);
      return this.cachedWalletChain;
    }

    // Cache miss - create via walletClient
    logger.debug(`[ClientManager] Wallet chain cache miss: ${this.walletChainId}, creating...`);
    this.cachedWalletChain = await this.walletClient.chain(this.walletChainId);
    logger.debug(`[ClientManager] Wallet chain cached: ${this.walletChainId}`);

    return this.cachedWalletChain;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * Destroy and cleanup both chains
   */
  async destroy(): Promise<void> {
    logger.info('[ClientManager] Destroying client...');

    // Clear all caches first
    this.clearAllCaches();

    // Cleanup public chain
    if (this.publicClient) {
      (this.publicClient).free();
    }
    if (this.publicWallet) {
      this.publicWallet.free();
    }

    // Cleanup wallet chain
    if (this.walletClient) {
      (this.walletClient).free();
    }
    if (this.walletWallet) {
      this.walletWallet.free();
    }

    this.publicClient = null;
    this.publicWallet = null;
    this.publicAutosigner = null;
    this.publicChainId = null;
    this.publicAddress = null;

    this.walletClient = null;
    this.walletWallet = null;
    this.walletSigner = null;
    this.walletAutosigner = null;
    this.walletChainId = null;
    this.walletAddress = null;

    this.mode = ClientMode.UNINITIALIZED;
    this.stateListeners.clear();

    this.notifyStateChange();
  }


  // ============================================
  // CACHE MANAGEMENT (private helpers)
  // ============================================

  /**
   * Evict oldest chain from cache (LRU strategy)
   */
  private evictOldestChain(): void {
    const firstKey = this.chainCache.keys().next().value;
    if (firstKey) {
      this.chainCache.delete(firstKey);
      logger.debug(`[ClientManager] Evicted chain from cache: ${firstKey}`);
    }
  }

  /**
   * Invalidate application cache
   * Called when wallet state changes (connect/disconnect/switch)
   */
  private invalidateAppCache(): void {
    if (this.appCache.size > 0) {
      logger.info(`[ClientManager] Invalidating application cache (${this.appCache.size} entries)`);
      this.appCache.clear();
    }
    // Also invalidate wallet chain cache since wallet state changed
    if (this.cachedWalletChain) {
      logger.debug('[ClientManager] Invalidating wallet chain cache');
      this.cachedWalletChain = null;
    }
  }

  /**
   * Clear all caches
   * Called on destroy
   */
  private clearAllCaches(): void {
    logger.debug('[ClientManager] Clearing all caches');
    this.chainCache.clear();
    this.appCache.clear();
    this.cachedWalletChain = null;
  }

  /**
   * Load Linera module
   */
  private async loadLinera(): Promise<LineraModule> {
    // Directly load the Linera WebAssembly module from the public directory
    // Using a function wrapper to bypass Turbopack's static analysis
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const moduleUrl = `${origin}/linera/wasm/index.js`;

    logger.info('Loading Linera module from:', moduleUrl);

    // Use Function constructor to create dynamic import that Turbopack can't analyze
    // This bypasses static analysis while still loading the module at runtime
    const loadModule = new Function('url', 'return import(url)');
    const lineraModule = await loadModule(moduleUrl) as LineraModule;

    logger.info('Linera module loaded:', lineraModule);

    return lineraModule;
  }

  /**
   * Notify all state listeners
   */
  private notifyStateChange(additionalState?: Partial<ClientState>): void {
    const state = { ...this.getState(), ...additionalState };
    this.stateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        logger.error('[ClientManager] State listener error:', error);
      }
    });
  }
}

/**
 * Singleton instance management
 */
let clientManagerInstance: LineraClientManager | null = null;

/**
 * Create or get the client manager singleton
 */
export function createLineraClient(config: ClientConfig): LineraClientManager {
  if (clientManagerInstance) {
    logger.debug('[ClientManager] Returning existing instance');
    return clientManagerInstance;
  }

  clientManagerInstance = new LineraClientManager(config);
  return clientManagerInstance;
}

/**
 * Get the current client manager instance
 */
export function getLineraClientManager(): LineraClientManager | null {
  return clientManagerInstance;
}

/**
 * Reset the client manager (useful for testing)
 */
export function resetLineraClientManager(): void {
  if (clientManagerInstance) {
    clientManagerInstance.destroy();
    clientManagerInstance = null;
  }
}
