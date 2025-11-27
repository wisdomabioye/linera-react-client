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

import type { Application } from '@linera/client';
import type {
  ApplicationClient,
  PublicClient,
  WalletClient,
  MutateOptions,
} from './types';
import { OperationType as OpType } from './types';
import { logger } from '../../utils/logger';

/**
 * Wrapper around Linera Application for cleaner API with dual-chain support
 */
export class ApplicationClientImpl implements ApplicationClient {
  readonly appId: string;
  readonly publicClient: PublicClient;
  readonly walletClient?: WalletClient;

  /**
   * @deprecated Use publicClient instead
   * Underlying Linera application instance (public chain)
   */
  readonly application: Application;

  private publicApp: Application;
  private walletApp?: Application;
  private canWriteWithWallet: boolean;
  private faucetUrl: string;
  private publicChainId?: string;
  private walletChainId?: string;
  private walletAddress?: string;

  constructor(
    appId: string,
    publicApp: Application,
    walletApp: Application | undefined,
    canWriteWithWallet: boolean,
    faucetUrl: string,
    publicChainId?: string,
    walletChainId?: string,
    walletAddress?: string
  ) {
    this.appId = appId;
    this.publicApp = publicApp;
    this.walletApp = walletApp;
    this.application = publicApp; // Deprecated - backward compatibility
    this.canWriteWithWallet = canWriteWithWallet;
    this.faucetUrl = faucetUrl;
    this.publicChainId = publicChainId;
    this.walletChainId = walletChainId;
    this.walletAddress = walletAddress;

    // Initialize split clients
    this.publicClient = this.createPublicClient();

    if (canWriteWithWallet && walletApp) {
      this.walletClient = this.createWalletClient();
    }
  }

  // ============================================
  // LEGACY API (backward compatible with deprecation warnings)
  // ============================================

  /**
   * @deprecated Use publicClient.query() instead
   * Execute a GraphQL query
   * Works in both read-only and full mode
   */
  async query<T = unknown>(gql: string, blockHash?: string): Promise<T> {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[ApplicationClient] DEPRECATED: query() is deprecated. Use publicClient.query() instead.');
    }
    return this.publicClient.query<T>(gql, blockHash);
  }

  /**
   * @deprecated Use publicClient.systemMutate() for system operations or walletClient.mutate() for user operations
   * Execute a GraphQL mutation with flexible operation type support
   *
   * @param gql - GraphQL mutation string
   * @param options - Either MutateOptions object or blockHash string (backward compat)
   *
   * @example
   * // User mutation (requires wallet) - default behavior
   * await app.mutate('mutation { transfer(amount: 100) }');
   *
   * // System mutation (auto-signed, no wallet needed)
   * await app.mutate(
   *   'mutation { subscribe(channelId: "abc") }',
   *   { operationType: OperationType.SYSTEM }
   * );
   *
   * // Backward compatible with blockHash
   * await app.mutate('mutation { ... }', 'block-hash-123');
   */
  async mutate<T = unknown>(
    gql: string,
    options?: MutateOptions | string
  ): Promise<T> {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[ApplicationClient] DEPRECATED: mutate() is deprecated. Use publicClient.systemMutate() for system operations or walletClient.mutate() for user operations.');
    }

    // Handle backward compatibility: string means blockHash
    const opts: MutateOptions = typeof options === 'string'
      ? { blockHash: options, operationType: OpType.USER }
      : { operationType: OpType.USER, ...options };

    const { operationType, blockHash } = opts;

    // Route based on operation type
    switch (operationType) {
      case OpType.SYSTEM:
        logger.debug(`[ApplicationClient] System mutation on public chain: ${this.publicChainId}`);
        return this.executeSystemMutation<T>(gql, blockHash);

      case OpType.USER:
        if (!this.canWriteWithWallet || !this.walletApp) {
          throw new Error(
            'User mutations require wallet connection. Please connect MetaMask or use operationType: OperationType.SYSTEM for auto-signed operations.'
          );
        }
        logger.debug(`[ApplicationClient] User mutation on wallet chain: ${this.walletChainId}`);
        return this.executeUserMutation<T>(gql, blockHash);

      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * @deprecated Use publicClient.queryChain() instead
   * Query any chain by ID via HTTP (no need to claim it)
   * @param chainId - Target chain ID to query
   * @param gql - GraphQL query string
   */
  async queryChain<T = unknown>(chainId: string, gql: string): Promise<T> {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[ApplicationClient] DEPRECATED: queryChain() is deprecated. Use publicClient.queryChain() instead.');
    }
    return this.publicClient.queryChain<T>(chainId, gql);
  }

  // ============================================
  // NEW SPLIT CLIENT API
  // ============================================

  private createPublicClient(): PublicClient {
    return {
      query: async <T>(gql: string, blockHash?: string): Promise<T> => {
        try {
          logger.debug(`[ApplicationClient] Query on public chain ${this.publicChainId}:`, gql);
          const result = await this.publicApp.query(gql, blockHash);
          return result as T;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`[ApplicationClient] Query failed:`, err);
          throw new Error(`Application query failed: ${err.message}`);
        }
      },

      queryChain: async <T>(chainId: string, gql: string): Promise<T> => {
        const endpoint = `${this.faucetUrl}/chains/${chainId}/applications/${this.appId}`;

        try {
          logger.debug(`[ApplicationClient] QueryChain ${chainId}:`, gql);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gql })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();

          if (result.errors) {
            throw new Error(result.errors[0]?.message || 'GraphQL query failed');
          }

          return result.data as T;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`[ApplicationClient] QueryChain failed:`, err);
          throw new Error(`Cross-chain query failed: ${err.message}`);
        }
      },

      systemMutate: async <T>(gql: string, blockHash?: string): Promise<T> => {
        return this.executeSystemMutation<T>(gql, blockHash);
      },
    };
  }

  private createWalletClient(): WalletClient {
    return {
      ...this.publicClient,

      mutate: async <T>(gql: string, blockHash?: string): Promise<T> => {
        if (!this.canWriteWithWallet || !this.walletApp) {
          throw new Error('Wallet client requires wallet connection');
        }
        return this.executeUserMutation<T>(gql, blockHash);
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
    blockHash?: string
  ): Promise<T> {
    try {
      logger.info(`[ApplicationClient] Executing system mutation on public chain: ${this.publicChainId}`);
      const result = await this.publicApp.query(gql, blockHash);
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
    blockHash?: string
  ): Promise<T> {
    try {
      if (!this.walletApp) {
        throw new Error('Wallet application not available');
      }
      logger.info(`[ApplicationClient] Executing user mutation on wallet chain: ${this.walletChainId}`);
      const result = await this.walletApp.query(gql, blockHash);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] User mutation failed:`, err);
      throw new Error(`Application mutation failed: ${err.message}`);
    }
  }

  /**
   * Static utility for querying any chain without client instance
   * @param faucetUrl - Faucet/node URL
   * @param chainId - Target chain ID to query
   * @param appId - Application ID
   * @param gql - GraphQL query string
   */
  static async queryChainStatic<T = unknown>(
    faucetUrl: string,
    chainId: string,
    appId: string,
    gql: string
  ): Promise<T> {
    const endpoint = `${faucetUrl}/chains/${chainId}/applications/${appId}`;

    try {
      logger.debug(`[ApplicationClient] Static query to chain ${chainId}:`, gql);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: gql })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL query failed');
      }

      return result.data as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] queryChainStatic failed:`, err);
      throw new Error(`Cross-chain query failed: ${err.message}`);
    }
  }
}
