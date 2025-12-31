/**
 * Application Client Wrapper
 *
 * Provides a clean interface for interacting with Linera applications,
 * handling queries and mutations with proper error handling.
 *
 * NEW: Dual-chain architecture
 * - Public chain (temporary signer): queries and system operations
 * - Wallet chain (MetaMask signer): user mutations
 */

import type { Application, QueryOptions } from '@linera/client';
import type {
  ApplicationClient,
  PublicApp,
  WalletApp,
  ChainApp,
} from './types';
import { logger } from '../../utils/logger';

/**
 * Wrapper around Linera Application for cleaner API with dual-chain support
 */
export class ApplicationClientImpl implements ApplicationClient {
  readonly appId: string;
  readonly public: PublicApp;
  readonly wallet?: WalletApp;

  private publicApp: Application;
  private walletApp?: Application;
  private canWriteWithWallet: boolean;
  private faucetUrl: string;
  private publicChainId?: string;
  private walletChainId?: string;
  private walletAddress?: string;
  private publicAddress?: string;

  constructor(
    appId: string,
    publicApp: Application,
    walletApp: Application | undefined,
    canWriteWithWallet: boolean,
    faucetUrl: string,
    publicChainId?: string,
    walletChainId?: string,
    walletAddress?: string,
    publicAddress?: string
  ) {
    this.appId = appId;
    this.publicApp = publicApp;
    this.walletApp = walletApp;
    this.canWriteWithWallet = canWriteWithWallet;
    this.faucetUrl = faucetUrl;
    this.publicChainId = publicChainId;
    this.walletChainId = walletChainId;
    this.walletAddress = walletAddress;
    this.publicAddress = publicAddress;

    // Initialize public and wallet app interfaces
    this.public = this.createPublicApp();

    if (canWriteWithWallet && walletApp) {
      this.wallet = this.createWalletApp();
    }
  }

  // ============================================
  // PUBLIC AND WALLET APP INTERFACES
  // ============================================

  private createPublicApp(): PublicApp {
    return {
      query: async <T>(gql: string, options?: QueryOptions): Promise<T> => {
        try {
          logger.debug(`[ApplicationClient] Query on public chain ${this.publicChainId}:`, gql);
          const result = await this.publicApp.query(gql, options);
          return result as T;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`[ApplicationClient] Query failed:`, err);
          throw new Error(`Application query failed: ${err.message}`);
        }
      },

      getAddress: (): string => {
        if (!this.publicAddress) {
          throw new Error('Public address not available');
        }
        return this.publicAddress;
      },

      getChainId: (): string => {
        if (!this.publicChainId) {
          throw new Error('Public chain ID not available');
        }
        return this.publicChainId;
      },
      
      systemMutate: async <T>(gql: string, options?: QueryOptions): Promise<T> => {
        return this.executeSystemMutation<T>(gql, options);
      },
    };
  }

  private createWalletApp(): WalletApp {
    return {
      query: async <T>(gql: string, options?: QueryOptions): Promise<T> => {
        if (!this.walletApp) {
          throw new Error('Wallet not connected or has been disconnected');
        }

        try {
          logger.debug(`[WalletApplicationClient] Query on wallet chain ${this.walletChainId}:`, gql);
          const result = await this.walletApp.query(gql, options);
          return result as T;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`[WalletApplicationClient] Query failed:`, err);
          throw new Error(`WalletApplication query failed: ${err.message}`);
        }
      },

      mutate: async <T>(gql: string, options?: QueryOptions): Promise<T> => {
        if (!this.walletApp) {
          throw new Error('Wallet not connected or has been disconnected');
        }
        return this.executeUserMutation<T>(gql, options);
      },

      getAddress: (): string => {
        if (!this.walletAddress) {
          throw new Error('Wallet address not available');
        }
        return this.walletAddress;
      },

      getChainId: (): string => {
        if (!this.walletChainId) {
          throw new Error('Wallet chain ID not available');
        }
        return this.walletChainId;
      },
    };
  }

  // ============================================
  // PRIVATE EXECUTION METHODS
  // ============================================

  /**
   * Execute system mutation on PUBLIC chain (auto-signed with temporary signer)
   * Used for subscriptions, cross-chain messaging setup, etc.
   * No user prompt required - uses temporary wallet
   */
  private async executeSystemMutation<T>(
    gql: string,
    options?: QueryOptions
  ): Promise<T> {
    try {
      logger.info(`[ApplicationClient] Executing system mutation on public chain: ${this.publicChainId}`);
      const result = await this.publicApp.query(gql, options);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] System mutation failed:`, err);
      throw new Error(`System operation failed: ${err.message}`);
    }
  }

  /**
   * Execute user mutation on WALLET chain (signed by MetaMask)
   * Used for transfers, user actions, etc.
   * Requires user signature via MetaMask
   */
  private async executeUserMutation<T>(
    gql: string,
    options?: QueryOptions
  ): Promise<T> {
    try {
      if (!this.walletApp) {
        throw new Error('Wallet application not available');
      }
      logger.info(`[ApplicationClient] Executing user mutation on wallet chain: ${this.walletChainId}`);
      const result = await this.walletApp.query(gql, options);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] User mutation failed:`, err);
      throw new Error(`Application mutation failed: ${err.message}`);
    }
  }
}

/**
 * Wrapper for standalone chain applications
 * Provides WalletApp-like interface for applications loaded from arbitrary chains
 */
export class ChainApplicationClient implements ChainApp {
  private app: Application;
  private chainId: string;
  private address: string;
  readonly appId: string;

  constructor(
    appId: string,
    app: Application,
    chainId: string,
    address: string
  ) {
    this.appId = appId;
    this.app = app;
    this.chainId = chainId;
    this.address = address;
  }

  /**
   * Execute GraphQL query on the chain
   */
  async query<T>(gql: string, options?: QueryOptions): Promise<T> {
    try {
      logger.debug(`[ChainApplicationClient] Query on chain ${this.chainId}:`, gql);
      const result = await this.app.query(gql, options);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ChainApplicationClient] Query failed:`, err);
      throw new Error(`Chain application query failed: ${err.message}`);
    }
  }

  /**
   * Execute mutation on the chain (signed by chain's signer)
   */
  async mutate<T>(gql: string, options?: QueryOptions): Promise<T> {
    try {
      logger.info(`[ChainApplicationClient] Executing mutation on chain: ${this.chainId}`);
      const result = await this.app.query(gql, options);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ChainApplicationClient] Mutation failed:`, err);
      throw new Error(`Chain application mutation failed: ${err.message}`);
    }
  }

  /**
   * Get chain owner address
   */
  getAddress(): string {
    return this.address;
  }

  /**
   * Get chain ID
   */
  getChainId(): string {
    return this.chainId;
  }
}
