/**
 * Linera Client Manager
 *
 * Manages the lifecycle of Linera client instances, handling:
 * - Initialization (WASM loading)
 * - Wallet connection and management
 * - Application client creation with flexible chain routing
 */

import type {
  Client,
  Wallet,
  Signer,
  Faucet,
  Chain,
} from '@linera/client';
// import * as _lineraDefault from '@linera/client';
import {
  LineraModule,
  ClientMode,
  ClientState,
  ClientConfig,
  ApplicationClient,
  StateChangeCallback,
  ILineraClientManager,
} from './types';
import { TemporarySigner } from './temporary-signer';
import { ApplicationClientImpl } from './application-client';
import { logger } from '../../utils/logger';

type SignerWithAddress = Signer & {address: () => Promise<string>}

/**
 * Main client manager implementation
 */
export class LineraClientManager implements ILineraClientManager {
  // Core Linera client (for chain access)
  private client: Client | null = null;
  private wallet: Wallet | null = null;

  // Default chain instance (cached for efficiency)
  private defaultChain: Chain | null = null;
  private defaultChainId: string | null = null;

  // Chain instance cache for multi-chain applications
  private chainCache: Map<string, Chain> = new Map();
  private readonly MAX_CACHED_CHAINS = 10; // Prevent unbounded cache growth

  // Wallet resources (only when wallet connected)
  private walletSigner: SignerWithAddress | null = null;
  private walletChainId: string | null = null;
  private walletAddress: string | null = null;

  private mode: ClientMode = ClientMode.UNINITIALIZED;
  private config: ClientConfig;
  private stateListeners: Set<StateChangeCallback> = new Set();
  private lineraModule: LineraModule | null = null;
  private faucet: Faucet | null = null;

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
      walletChainId: this.walletChainId || undefined,
      defaultChainId: this.defaultChainId || this.config.defaultChainId,
      faucetUrl: this.config.faucetUrl,
    };
  }

  /**
   * Get the base Linera client for low-level access
   * Use getApplication() for most operations
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get wallet instance
   */
  getWallet(): Wallet | null {
    return this.wallet;
  }

  /**
   * Get or create a Chain instance with caching
   * @param chainId - The chain ID to get
   * @returns Chain instance (cached if possible)
   */
  async getChain(chainId: string): Promise<Chain> {
    // Check cache first
    if (this.chainCache.has(chainId)) {
      logger.debug('[ClientManager] Using cached chain:', chainId);
      return this.chainCache.get(chainId)!;
    }

    // Create new chain instance
    logger.debug('[ClientManager] Creating new chain instance:', chainId);
    const chain = await this.client!.chain(chainId);

    // Add to cache (with size limit)
    if (this.chainCache.size >= this.MAX_CACHED_CHAINS) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this.chainCache.keys().next().value;
      if (firstKey && firstKey !== this.defaultChainId) {
        logger.debug('[ClientManager] Cache full, removing:', firstKey);
        this.chainCache.delete(firstKey);
      }
    }

    this.chainCache.set(chainId, chain);
    return chain;
  }

  /**
   * Remove a specific chain from cache
   * @param chainId - The chain ID to remove from cache
   */
  removeChainFromCache(chainId: string): void {
    if (this.chainCache.has(chainId)) {
      logger.debug('[ClientManager] Removing chain from cache:', chainId);
      this.chainCache.delete(chainId);
    }
  }

  /**
   * Clear the chain cache (useful when chain state changes)
   */
  clearChainCache(): void {
    logger.debug('[ClientManager] Clearing chain cache');
    this.chainCache.clear();

    // Re-add default chain if it exists
    if (this.defaultChainId && this.defaultChain) {
      this.chainCache.set(this.defaultChainId, this.defaultChain);
    }
  }

  /**
   * Initialize client (loads WASM, creates faucet, wallet, and base client)
   * After this, client is ready for queries and wallet connection
   */
  async initialize(): Promise<void> {
    if (this.mode !== ClientMode.UNINITIALIZED) {
      logger.debug('[ClientManager] Already initialized');
      return;
    }

    try {
      logger.info('[ClientManager] Initializing Linera client...');

      // 1. Load Linera module
      this.lineraModule = await this.loadLinera();

      if (!this.lineraModule) {
        throw new Error('Linera module failed to load');
      }

      const { Client, Faucet, default: init } = this.lineraModule;

      // 2. Initialize WASM
      logger.debug('[ClientManager] Loading WASM...');
      await init();

      // 3. Create faucet
      logger.debug('[ClientManager] Creating faucet...');
      this.faucet = new Faucet(this.config.faucetUrl);

      // 4. Create wallet
      logger.debug('[ClientManager] Creating wallet...');
      this.wallet = await this.faucet.createWallet();

      // 5. Create dummy signer for read-only mode
      logger.debug('[ClientManager] Creating read-only signer...');
      const dummySigner = new TemporarySigner();
      const dummyOwner = await dummySigner.address();

      // 6. Create base client
      logger.debug('[ClientManager] Creating client...');
      const clientInstance = new Client(
        this.wallet,
        dummySigner,
        {
          skipProcessInbox: this.config.skipProcessInbox || false
        }
      );

      this.client = await Promise.resolve(clientInstance);

      // 7. Setup default chain
      if (this.config.defaultChainId) {
        // Use configured default chain
        logger.debug('[ClientManager] Using configured default chain:', this.config.defaultChainId);
        this.defaultChainId = this.config.defaultChainId;
      } else {
        // Claim a chain as default
        logger.debug('[ClientManager] No default chain configured, claiming one...');
        this.defaultChainId = await this.faucet.claimChain(this.wallet, dummyOwner);
        logger.info('[ClientManager] Default chain claimed:', this.defaultChainId);
      }

      // Get and cache default chain instance
      logger.debug('[ClientManager] Getting default chain instance...');
      this.defaultChain = await this.client.chain(this.defaultChainId);
      this.chainCache.set(this.defaultChainId, this.defaultChain);
      logger.info('[ClientManager] Default chain cached:', this.defaultChainId);

      this.mode = ClientMode.READ_ONLY;
      this.notifyStateChange();

      logger.info('[ClientManager] Client initialized successfully');
    } catch (error) {
      this.mode = ClientMode.UNINITIALIZED;
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to initialize client: ${err.message}`);
    }
  }

  /**
   * Connect MetaMask wallet
   */
  async connectWallet(metamaskSigner: SignerWithAddress): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection only available on client side');
    }

    try {
      logger.info('[ClientManager] Connecting wallet...');

      // Ensure we're initialized
      if (this.mode === ClientMode.UNINITIALIZED) {
        await this.initialize();
      }

      // Ensure we have a default chain
      if (!this.defaultChain || !this.defaultChainId) {
        throw new Error('No default chain configured. Set defaultChainId in config.');
      }

      // Get wallet address
      const owner = await metamaskSigner.address();
      logger.info('[ClientManager] Wallet address:', owner);

      // Check if same wallet already connected
      const isSameWallet = this.walletAddress?.toLowerCase() === owner.toLowerCase();

      if (isSameWallet && this.walletChainId) {
        logger.info('[ClientManager] Same wallet already connected');

        // Only update signer if changed
        if (this.walletSigner !== metamaskSigner) {
          this.walletSigner = metamaskSigner;
          this.notifyStateChange();
        }

        return;
      }

      // Claim wallet chain for mutations
      logger.info('[ClientManager] Claiming wallet chain...');
      this.walletChainId = await this.faucet!.claimChain(this.wallet!, owner);
      logger.info('[ClientManager] Wallet chain claimed:', this.walletChainId);

      // Recreate client with MetaMask signer (fixes query/mutation issues)
      logger.info('[ClientManager] Recreating client with wallet signer...');
      this.client = new (this.lineraModule!.Client)(
        this.wallet!,
        metamaskSigner,
        {
          skipProcessInbox: this.config.skipProcessInbox || false
        }
      );
      logger.info('[ClientManager] Client recreated with wallet signer');

      // Refresh default chain with new client
      logger.debug('[ClientManager] Refreshing default chain with new client...');
      this.defaultChain = await this.client.chain(this.defaultChainId!);

      // Clear and rebuild cache
      this.clearChainCache();
      this.chainCache.set(this.defaultChainId!, this.defaultChain);
      logger.info('[ClientManager] Chain cache refreshed');

      // Update wallet state
      this.walletSigner = metamaskSigner;
      this.walletAddress = owner;

      this.mode = ClientMode.FULL;
      this.notifyStateChange();

      logger.info('[ClientManager] Wallet connected:', owner);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to connect wallet: ${err.message}`);
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    if (this.mode !== ClientMode.FULL) {
      logger.debug('[ClientManager] No wallet to disconnect');
      return;
    }

    logger.info('[ClientManager] Disconnecting wallet...');

    try {
      // Remove wallet chain from cache
      if (this.walletChainId) {
        this.removeChainFromCache(this.walletChainId);
      }

      // Recreate client with dummySigner to restore read-only mode
      logger.info('[ClientManager] Recreating client with dummy signer...');
      const dummySigner = new TemporarySigner();

      this.client = new (this.lineraModule!.Client)(
        this.wallet!,
        dummySigner,
        {
          skipProcessInbox: this.config.skipProcessInbox || false
        }
      );
      logger.info('[ClientManager] Client recreated with dummy signer');

      // Refresh default chain with new client
      logger.debug('[ClientManager] Refreshing default chain after disconnect...');
      this.defaultChain = await this.client.chain(this.defaultChainId!);

      // Clear and rebuild cache
      this.clearChainCache();
      this.chainCache.set(this.defaultChainId!, this.defaultChain);
      logger.info('[ClientManager] Chain cache refreshed after disconnect');

      // Clear wallet state
      this.walletSigner = null;
      this.walletChainId = null;
      this.walletAddress = null;

      this.mode = ClientMode.READ_ONLY;
      this.notifyStateChange();

      logger.info('[ClientManager] Wallet disconnected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[ClientManager] Failed to disconnect wallet:', err);
      throw new Error(`Failed to disconnect wallet: ${err.message}`);
    }
  }

  /**
   * Switch to different MetaMask wallet
   */
  async switchWallet(newSigner: SignerWithAddress): Promise<void> {
    logger.info('[ClientManager] Switching wallet...');
    await this.connectWallet(newSigner);
  }

  /**
   * Get application client interface
   * @param appId - Application ID
   * @param chainId - Optional chain ID where the app is deployed (uses defaultChainId if not provided)
   *
   * Note: The chainId parameter specifies where the application is deployed.
   * - For queries: Works in both READ_ONLY and FULL mode
   * - For mutations: Requires FULL mode (wallet connected)
   * - Gas fees for mutations are paid from walletChainId
   */
  async getApplication(appId: string, chainId?: string): Promise<ApplicationClient | null> {
    if (this.mode === ClientMode.UNINITIALIZED) {
      logger.warn('[ClientManager] Client not initialized');
      return null;
    }

    // Determine which chainId to use
    const targetChainId = chainId || this.config.defaultChainId;

    if (!targetChainId) {
      throw new Error(
        'No chainId provided and no defaultChainId configured. ' +
        'Either pass chainId parameter or set defaultChainId in config.'
      );
    }

    try {
      // Get chain instance (uses cache when possible)
      const chain = await this.getChain(targetChainId);
      const app = await chain.application(appId);

      if (!app) {
        logger.error('[ClientManager] Could not load app from client');
        return null;
      }

      return new ApplicationClientImpl(
        appId,
        targetChainId,
        app,
        this.walletSigner,
        this.walletChainId || undefined,
        this.walletAddress || undefined,
        this.config.faucetUrl
      );
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
   * Destroy and cleanup client resources
   */
  async destroy(): Promise<void> {
    logger.info('[ClientManager] Destroying client...');

    // Cleanup client
    if (this.client) {
      try {
        (this.client as any).free?.();
      } catch (e) {
        logger.debug('[ClientManager] Client free failed:', e);
      }
    }

    // Cleanup wallet
    if (this.wallet) {
      try {
        this.wallet.free();
      } catch (e) {
        logger.debug('[ClientManager] Wallet free failed:', e);
      }
    }

    this.client = null;
    this.wallet = null;
    this.defaultChain = null;
    this.defaultChainId = null;
    this.chainCache.clear();
    this.walletSigner = null;
    this.walletChainId = null;
    this.walletAddress = null;

    this.mode = ClientMode.UNINITIALIZED;
    this.stateListeners.clear();

    this.notifyStateChange();
  }

  /**
   * Reinitialize client after error
   * Strategy:
   * 1. Best-effort destroy
   * 2. Reload WASM module
   * 3. Reinitialize
   * 4. Reconnect wallet if was connected
   */
  async reinit(): Promise<void> {
    logger.info('[ClientManager] Reinitializing...');

    // Preserve wallet signer for reconnection
    const previousWalletSigner = this.walletSigner;
    const hadWallet = !!previousWalletSigner;

    // Best-effort destroy
    try {
      await this.destroy();
    } catch (destroyErr) {
      logger.warn('[ClientManager] Destroy failed during reinit:', destroyErr);
    }

    // Force-clear state
    this.client = null;
    this.wallet = null;
    this.defaultChain = null;
    this.defaultChainId = null;
    this.chainCache.clear();
    this.walletSigner = null;
    this.walletChainId = null;
    this.walletAddress = null;
    this.mode = ClientMode.UNINITIALIZED;
    this.notifyStateChange();

    // Reload WASM module
    try {
      this.lineraModule = await this.loadLinera();
      const { initialize: init } = this.lineraModule as LineraModule;
      await init();
    } catch (initErr) {
      logger.error('[ClientManager] WASM init failed:', initErr);
      // Fallback to page reload
      if (typeof window !== 'undefined') {
        try {
          logger.info('[ClientManager] Falling back to page reload');
          window.location.reload();
          return;
        } catch {
          throw initErr;
        }
      }
      throw initErr;
    }

    // Reinitialize
    try {
      await this.initialize();
    } catch (initErr) {
      logger.error('[ClientManager] Initialization failed:', initErr);
      if (typeof window !== 'undefined') {
        try {
          window.location.reload();
          return;
        } catch {
          throw initErr;
        }
      }
      throw initErr;
    }

    // Reconnect wallet if was connected
    if (hadWallet && previousWalletSigner) {
      try {
        await this.connectWallet(previousWalletSigner);
      } catch (walletErr) {
        logger.warn('[ClientManager] Wallet reconnection failed:', walletErr);
        this.notifyStateChange({
          error: walletErr instanceof Error ? walletErr : new Error(String(walletErr))
        });
      }
    }

    this.notifyStateChange();
    logger.info('[ClientManager] Reinitialization complete');
  }


  /**
   * Load Linera module
   */
  private async loadLinera(): Promise<LineraModule | null> {
    let lineraModule: LineraModule | null = null;

    // @ts-ignore - process.env might not exist in browser
    const isTest = typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');
    const isBrowser = typeof window !== 'undefined' && !isTest;

    if (!isBrowser) {
      try {
          // Try to resolve the package location
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          const resolvedPath = require.resolve('@linera/client');
          
          logger.info('[ClientManager] Resolved path:', resolvedPath);
          
          // Import from resolved path
          lineraModule = await import(resolvedPath);
      } catch (error) {
        logger.error('[ClientManager] Failed to resolve package:', error);
        throw error;
      }

    } else {
      const origin = window.location.origin;
      // Load from wasm/index.js to get the new API with Client.chain() support
      const moduleUrl = `${origin}/linera/wasm/index.js`;
      logger.info('Loading Linera module from:', moduleUrl);

      // Use Function constructor to create dynamic import that Turbopack can't analyze
      const loadModule = new Function('url', 'return import(url)');
      lineraModule = await loadModule(moduleUrl) as LineraModule;
    }

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
