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
} from '@linera/client';

import {
  ClientMode,
  ClientState,
  ClientConfig,
  ApplicationClient,
  StateChangeCallback,
  ILineraClientManager,
} from './types';

import { TemporarySigner } from './temporary-signer';
import { ApplicationClientImpl } from './application-client';
import type { LineraModule } from './linera-types';
import { logger } from '../../utils/logger';

type SignerWithAddress = Signer & {address: () => Promise<string>}

/**
 * Main client manager implementation
 */
export class LineraClientManager implements ILineraClientManager {
  private client: Client | null = null;
  private wallet: Wallet | null = null;
  private signer: SignerWithAddress | null = null;
  private chainId: string | null = null;
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
      chainId: this.chainId || undefined,
      faucetUrl: this.config.faucetUrl,
    };
  }

  /**
   * Get raw Linera client
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
   * Initialize in read-only mode with temporary wallet
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

      // Create wallet from faucet
      this.wallet = await this.faucet.createWallet();

      // Create temporary signer for guest mode with configured options
      const tempSigner = new TemporarySigner(this.config.readOnlyWallet);
      this.signer = tempSigner;

      // Get temporary address
      const tempOwner = await tempSigner.address();
      this.walletAddress = tempOwner;

      // Claim a temporary chain
      logger.info('[ClientManager] Claiming temporary chain...');
      this.chainId = await this.faucet.claimChain(this.wallet, tempOwner);
      logger.info('[ClientManager] Temporary chain claimed:', this.chainId);

      // Create client in read-only mode
      // Note: Client constructor may return a Promise in WASM environment
      const clientInstance = new Client(
        this.wallet,
        this.signer,
        this.config.skipProcessInbox || false
      );
      this.client = await Promise.resolve(clientInstance);

      this.mode = ClientMode.READ_ONLY;
      this.notifyStateChange();

      logger.info('[ClientManager] Read-only mode initialized successfully');
    } catch (error) {
      this.mode = ClientMode.UNINITIALIZED;
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to initialize read-only client: ${err.message}`);
    }
  }

  /**
   * Connect MetaMask wallet (upgrade to full mode)
   */
  async connectWallet(metamaskSigner: SignerWithAddress): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Wallet connection only available on client side');
    }

    try {
      logger.info('[ClientManager] Connecting wallet...');

      // Ensure we're initialized first
      if (this.mode === ClientMode.UNINITIALIZED) {
        await this.initializeReadOnly();
      }

      // Get MetaMask address
      const owner = await metamaskSigner.address();
      logger.info('[ClientManager] MetaMask address:', owner);

      // Check if we need to create new wallet or can reuse
      const needsNewWallet = this.walletAddress?.toLowerCase() !== owner.toLowerCase();

      if (needsNewWallet) {
        logger.info('[ClientManager] Claiming chain for new wallet...');

        // Cleanup old client if exists
        if (this.client) {
          (await this.client).free();
        }

        // Create new wallet from faucet
        if (!this.faucet) {
          const { Faucet, default: init } = this.lineraModule as LineraModule;
          await init();
          this.faucet = new Faucet(this.config.faucetUrl);
        }

        this.wallet = await this.faucet!.createWallet();

        // Claim chain for this MetaMask address
        this.chainId = await this.faucet!.claimChain(this.wallet, owner);
        logger.info('[ClientManager] Chain claimed:', this.chainId);
      }

      // Update signer and address
      this.signer = metamaskSigner;
      this.walletAddress = owner;

      // Create new client with MetaMask signer
      const { Client } = this.lineraModule as LineraModule;
      // Note: Client constructor may return a Promise in WASM environment
      const clientInstance = new Client(
        this.wallet as Wallet,
        this.signer,
        this.config.skipProcessInbox || false
      );
      this.client = await Promise.resolve(clientInstance);

      this.mode = ClientMode.FULL;
      this.notifyStateChange();

      logger.info('[ClientManager] Wallet connected successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyStateChange({ error: err });
      throw new Error(`Failed to connect wallet: ${err.message}`);
    }
  }

  /**
   * Disconnect wallet (revert to read-only with temporary wallet)
   */
  async disconnectWallet(): Promise<void> {
    if (this.mode !== ClientMode.FULL) {
      logger.debug('[ClientManager] No wallet to disconnect');
      return;
    }

    logger.info('[ClientManager] Disconnecting wallet...');

    // Cleanup current client
    if (this.client) {
      (this.client).free();
    }

    // Reinitialize in read-only mode
    this.mode = ClientMode.UNINITIALIZED;
    this.client = null;
    this.wallet = null;
    this.signer = null;
    this.chainId = null;
    this.walletAddress = null;

    await this.initializeReadOnly();

    logger.info('[ClientManager] Wallet disconnected, reverted to read-only mode');
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
   */
  async getApplication(appId: string): Promise<ApplicationClient | null> {
    if (!this.client) {
      logger.warn('[ClientManager] Client not initialized');
      return null;
    }

    try {
      const app = await this.client.frontend().application(appId);
      return new ApplicationClientImpl(
        appId,
        app,
        this.mode === ClientMode.FULL,
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
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    logger.info('[ClientManager] Destroying client...');

    if (this.client) {
      (this.client).free();
    }
    if (this.wallet) {
      this.wallet.free();
    }

    this.client = null;
    this.wallet = null;
    this.signer = null;
    this.chainId = null;
    this.walletAddress = null;
    this.mode = ClientMode.UNINITIALIZED;
    this.stateListeners.clear();

    this.notifyStateChange();
  }

  /**
   * Load Linera module
   */
  private async loadLinera(): Promise<LineraModule> {
    // Directly load the Linera WebAssembly module from the public directory
    // Using dynamic import with URL to work with all bundlers
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const moduleUrl = `${origin}/linera/linera_web.js`;

    logger.info('Loading Linera module from:', moduleUrl);

    // Load the module using dynamic import with URL
    const lineraModule = await import(/* @vite-ignore */ /* webpackIgnore: true */ moduleUrl) as LineraModule;

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
