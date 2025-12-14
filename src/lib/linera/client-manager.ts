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
} from '@linera/client';

import {
  ClientMode,
  ClientState,
  ClientConfig,
  ApplicationClient,
  StateChangeCallback,
  ILineraClientManager,
} from './types';
import type { LineraModule } from './linera-types';
import { TemporarySigner } from './temporary-signer';
import { ApplicationClientImpl } from './application-client';
import { logger } from '../../utils/logger';

type SignerWithAddress = Signer & {address: () => Promise<string>}

/**
 * Main client manager implementation
 */
export class LineraClientManager implements ILineraClientManager {
  // Public chain resources (temporary signer, always available after initialization)
  private publicClient: Client | null = null;
  private publicWallet: Wallet | null = null;
  private publicSigner: SignerWithAddress | null = null;
  private publicChainId: string | null = null;
  private publicAddress: string | null = null;

  // Wallet chain resources (MetaMask signer, only when wallet connected)
  private walletClient: Client | null = null;
  private walletWallet: Wallet | null = null;
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
      publicAddress: this.publicAddress || undefined,
      publicChainId: this.publicChainId || undefined,
      walletChainId: this.walletChainId || undefined,
      // Deprecated chainId - returns walletChainId if available, otherwise publicChainId
      chainId: this.walletChainId || this.publicChainId || undefined,
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
   * @deprecated Use getPublicClient() or getWalletClient() instead
   * Get raw Linera client (returns wallet client if available, otherwise public client)
   */
  getClient(): Client | null {
    return this.walletClient || this.publicClient;
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
      this.publicSigner = tempSigner;

      // Get temporary address
      const tempOwner = await tempSigner.address();
      this.publicAddress = tempOwner;

      // Claim PUBLIC chain for queries and subscriptions
      logger.info('[ClientManager] Claiming public chain for queries/subscriptions...');
      this.publicChainId = await this.faucet.claimChain(this.publicWallet, tempOwner);
      logger.info('[ClientManager] Public chain claimed:', this.publicChainId);

      // Create public client
      // Note: Client constructor may return a Promise in WASM environment
      const clientInstance = new Client(
        this.publicWallet,
        this.publicSigner,
        this.config.skipProcessInbox || false
      );
      this.publicClient = await Promise.resolve(clientInstance);

      this.mode = ClientMode.READ_ONLY;
      this.notifyStateChange();

      logger.info('[ClientManager] Read-only mode initialized successfully');
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

      // Create wallet wallet from faucet
      if (!this.faucet) {
        const { Faucet, default: init } = this.lineraModule as LineraModule;
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

      // Create wallet client
      const { Client } = this.lineraModule as LineraModule;
      // Note: Client constructor may return a Promise in WASM environment
      const clientInstance = new Client(
        this.walletWallet as Wallet,
        this.walletSigner,
        this.config.skipProcessInbox || false
      );
      this.walletClient = await Promise.resolve(clientInstance);

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
    this.walletChainId = null;
    this.walletAddress = null;

    // Public chain resources remain UNTOUCHED
    // this.publicClient - still active
    // this.publicWallet - still active
    // this.publicChainId - still active

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
   */
  async getApplication(appId: string): Promise<ApplicationClient | null> {
    if (!this.publicClient) {
      logger.warn('[ClientManager] Client not initialized');
      return null;
    }

    try {
      // Get application instance from public client (for queries/subscriptions)
      const publicApp = await this.publicClient.frontend().application(appId);

      // Get application instance from wallet client if available (for mutations)
      let walletApp: Application | undefined;
      if (this.walletClient) {
        walletApp = await this.walletClient.frontend().application(appId);
      }

      return new ApplicationClientImpl(
        appId,
        publicApp,
        walletApp,
        this.mode === ClientMode.FULL,
        this.config.faucetUrl,
        this.publicChainId || undefined,
        this.walletChainId || undefined,
        this.walletAddress || undefined,
        this.publicAddress || undefined,
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
   * Destroy and cleanup both chains
   */
  async destroy(): Promise<void> {
    logger.info('[ClientManager] Destroying client...');
    
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
    this.publicSigner = null;
    this.publicChainId = null;
    this.publicAddress = null;

    this.walletClient = null;
    this.walletWallet = null;
    this.walletSigner = null;
    this.walletChainId = null;
    this.walletAddress = null;

    this.mode = ClientMode.UNINITIALIZED;
    this.stateListeners.clear();

    this.notifyStateChange();
  }

  /**
   * Robust reinit: attempt a full deterministic restart.
   *
   * Strategy:
   * 1. Try a best-effort destroy (don't let its errors stop progress).
   * 2. Force-clear any lingering references (free() where available).
   * 3. Reload the linera module and init the wasm (init()).
   * 4. Recreate public client (and reconnect wallet signer if present).
   * 5. If anything irrecoverable happens, perform a hard reload.
   */
  async reinit(): Promise<void> {
    logger.info('[ClientManager] reinit(): starting full restart');

    // Preserve wallet signer so we can try to reconnect it after reinit
    const previousWalletSigner = this.walletSigner;
    const hadWallet = !!previousWalletSigner;

    // 1) Best-effort destroy but never abort on error
    try {
      // destroy() may throw if wasm is corrupted — catch and proceed
      await this.destroy();
    } catch (destroyErr) {
      logger.warn('[ClientManager] reinit(): destroy() threw, continuing anyway', destroyErr);
      // proceed to forced cleanup below
    }

    // 2) Forced cleanup of any lingering references (ignore errors)
    try {
      if (this.publicClient) {
        try { (this.publicClient as any).free?.(); } catch (e) { logger.debug('[ClientManager] publicClient.free() failed', e); }
      }
    } catch (e) { logger.debug('[ClientManager] ignoring publicClient free error', e); }
    try {
      if (this.publicWallet) { try { (this.publicWallet as any).free?.(); } catch (e) { logger.debug('[ClientManager] publicWallet.free() failed', e); } }
    } catch (e) { logger.debug('[ClientManager] ignoring publicWallet free error', e); }

    // Clear internal state references to ensure deterministic init path
    this.publicClient = null;
    this.publicWallet = null;
    this.publicSigner = null;
    this.publicChainId = null;
    this.publicAddress = null;

    this.walletClient = null;
    this.walletWallet = null;
    this.walletSigner = previousWalletSigner ?? null; // keep signer for reconnect attempt
    this.walletChainId = null;
    this.walletAddress = null;

    this.mode = ClientMode.UNINITIALIZED;
    this.notifyStateChange();

    // 3) (Re)load linera module and init WASM
    try {
      // Reload module to get a fresh vm if possible
      this.lineraModule = await this.loadLinera();
      const { default: init } = this.lineraModule as LineraModule;

      // init() may itself throw if the wasm is unhealthy; wrap it
      await init();
    } catch (initErr) {
      logger.error('[ClientManager] reinit(): wasm init failed', initErr);
      // fallback to full reload of the page as last resort
      try {
        logger.info('[ClientManager] reinit(): falling back to window.location.reload()');
        window.location.reload();
        return;
      } catch {
        throw initErr;
      }
    }

    // 4) Recreate public chain resources by calling initializeReadOnly()
    try {
      await this.initializeReadOnly();
    } catch (initReadOnlyErr) {
      logger.error('[ClientManager] reinit(): initializeReadOnly() failed', initReadOnlyErr);
      // hard reload as fallback
      try {
        window.location.reload();
        return;
      } catch {
        throw initReadOnlyErr;
      }
    }

    // 5) If we previously had a wallet signer, try to reconnect it (best-effort)
    if (hadWallet && previousWalletSigner) {
      try {
        await this.connectWallet(previousWalletSigner);
      } catch (walletErr) {
        // Keep public client running; notify listeners about partial failure.
        logger.warn('[ClientManager] reinit(): reconnecting wallet failed (public client active)', walletErr);
        this.notifyStateChange({ error: walletErr instanceof Error ? walletErr : new Error(String(walletErr)) });
      }
    }

    // Final state notification
    this.notifyStateChange();
    logger.info('[ClientManager] reinit(): completed successfully (or recovered to public client)');
  }


  /**
   * Load Linera module
   */
  private async loadLinera(): Promise<LineraModule> {
    // Directly load the Linera WebAssembly module from the public directory
    // Using a function wrapper to bypass Turbopack's static analysis
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const moduleUrl = `${origin}/linera/linera_web.js`;

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
