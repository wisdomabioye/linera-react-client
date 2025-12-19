/**
 * Application Client Wrapper
 *
 * Provides a clean interface for interacting with Linera applications:
 * - Queries (free, no wallet needed)
 * - Mutations (requires wallet for gas fees)
 * - Cross-chain queries
 */

import type { Application } from '@linera/client';
import type { ApplicationClient } from './types';
import type { Signer } from '@linera/client';
import { logger } from '../../utils/logger';

/**
 * Wrapper around Linera Application for cleaner API
 */
export class ApplicationClientImpl implements ApplicationClient {
  readonly appId: string;
  readonly chainId: string;

  private app: Application;
  private walletSigner: (Signer & { address: () => Promise<string> }) | null;
  private walletChainId: string | undefined;
  private walletAddress: string | undefined;
  private faucetUrl: string;

  constructor(
    appId: string,
    chainId: string,
    app: Application,
    walletSigner: (Signer & { address: () => Promise<string> }) | null,
    walletChainId: string | undefined,
    walletAddress: string | undefined,
    faucetUrl: string
  ) {
    this.appId = appId;
    this.chainId = chainId;
    this.app = app;
    this.walletSigner = walletSigner;
    this.walletChainId = walletChainId;
    this.walletAddress = walletAddress;
    this.faucetUrl = faucetUrl;
  }

  /**
   * Execute GraphQL query on the application chain
   * Queries are free and don't require a wallet
   */
  async query<T = unknown>(gql: string, blockHash?: string): Promise<T> {
    try {
      logger.debug(`[ApplicationClient] Query on chain ${this.chainId}:`, gql);
      const result = await this.app.query(gql, { blockHash });
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] Query failed:`, err);
      throw new Error(`Application query failed: ${err.message}`);
    }
  }

  /**
   * Query any chain by ID via HTTP
   * Useful for cross-chain queries
   */
  async queryChain<T = unknown>(chainId: string, gql: string): Promise<T> {
    const endpoint = `${this.faucetUrl}/chains/${chainId}/applications/${this.appId}`;

    try {
      logger.debug(`[ApplicationClient] Cross-chain query to ${chainId}:`, gql);

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
      logger.error(`[ApplicationClient] Cross-chain query failed:`, err);
      throw new Error(`Cross-chain query failed: ${err.message}`);
    }
  }

  /**
   * Execute mutation on the application
   * Requires connected wallet to sign and pay gas fees
   */
  async mutate<T = unknown>(gql: string, blockHash?: string): Promise<T> {
    if (!this.canMutate()) {
      throw new Error(
        'Wallet not connected. Please connect wallet to perform mutations.'
      );
    }

    try {
      logger.info(`[ApplicationClient] Executing mutation (wallet chain: ${this.walletChainId})`);
      const result = await this.app.query(gql, { blockHash });
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] Mutation failed:`, err);
      throw new Error(`Application mutation failed: ${err.message}`);
    }
  }

  /**
   * Get connected wallet address (if wallet is connected)
   */
  getWalletAddress(): string | undefined {
    return this.walletAddress;
  }

  /**
   * Get wallet chain ID (if wallet is connected)
   */
  getWalletChainId(): string | undefined {
    return this.walletChainId;
  }

  /**
   * Check if wallet is connected and mutations are possible
   */
  canMutate(): boolean {
    return !!(this.walletSigner && this.walletChainId && this.walletAddress);
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
