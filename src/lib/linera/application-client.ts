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
}
