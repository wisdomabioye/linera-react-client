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
} from '@linera/client';

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
import { createRequire } from 'module';

type SignerWithAddress = Signer & {address: () => Promise<string>}

/**
 * Main client manager implementation
 */
export class LineraClientManager implements ILineraClientManager {
  // Core Linera client (for chain access)
  private client: Client | null = null;
  private wallet: Wallet | null = null;

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
      defaultChainId: this.config.defaultChainId,
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

      // 5. Create base client with dummy signer
      logger.debug('[ClientManager] Creating client...');
      const dummySigner = new TemporarySigner();
      const clientInstance = new Client(
        this.wallet,
        dummySigner,
        this.config.skipProcessInbox || false
      );
      this.client = await Promise.resolve(clientInstance);

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
   * Connect MetaMask wallet (claims wallet chain for gas fees)
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

      // Get MetaMask address
      const owner = await metamaskSigner.address();
      logger.info('[ClientManager] Wallet address:', owner);

      // Check if same wallet already connected
      const isSameWallet = this.walletAddress?.toLowerCase() === owner.toLowerCase();

      if (isSameWallet && this.walletChainId) {
        logger.info('[ClientManager] Same wallet already connected, reusing chain:', this.walletChainId);

        // Only update signer if changed
        if (this.walletSigner !== metamaskSigner) {
          this.walletSigner = metamaskSigner;
          this.notifyStateChange();
        }

        return;
      }

      // Claim wallet chain for gas fees
      logger.info('[ClientManager] Claiming wallet chain for gas fees...');
      this.walletChainId = await this.faucet!.claimChain(this.wallet!, owner);
      logger.info('[ClientManager] Wallet chain claimed:', this.walletChainId);

      // Update wallet state
      this.walletSigner = metamaskSigner;
      this.walletAddress = owner;

      this.mode = ClientMode.FULL;
      this.notifyStateChange();

      logger.info('[ClientManager] Wallet connected:', owner);
      logger.info('[ClientManager] Wallet chain (for gas):', this.walletChainId);
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

    // Clear wallet state
    this.walletSigner = null;
    this.walletChainId = null;
    this.walletAddress = null;

    // Revert to READ_ONLY mode
    this.mode = ClientMode.READ_ONLY;
    this.notifyStateChange();

    logger.info('[ClientManager] Wallet disconnected');
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
   * @param chainId - Optional chain ID (uses defaultChainId if not provided)
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
      // Use new API: client.chain(chainId).application(appId)
      const chain = await this.client!.chain(targetChainId);
      const app = await chain.application(appId);

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
    this.walletSigner = null;
    this.walletChainId = null;
    this.walletAddress = null;
    this.mode = ClientMode.UNINITIALIZED;
    this.notifyStateChange();

    // Reload WASM module
    try {
      this.lineraModule = await this.loadLinera();
      const { default: init } = this.lineraModule as LineraModule;
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
    // Directly load the Linera WebAssembly module from the public directory or node_module folder
    // Using a function wrapper to bypass Turbopack's static analysis
    
    let lineraModule: LineraModule | null = null;

    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const moduleUrl = `${origin}/linera/linera.js`;
      logger.info('Loading Linera module from:', moduleUrl);

      // Use Function constructor to create dynamic import that Turbopack can't analyze
      // This bypasses static analysis while still loading the module at runtime
      const loadModule = new Function('url', 'return import(url)');
      lineraModule = await loadModule(moduleUrl) as LineraModule;

    } else {
      const require = createRequire(import.meta.url)
      lineraModule = require('@linera/client')
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
