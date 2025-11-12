/**
 * Application Client Wrapper
 *
 * Provides a clean interface for interacting with Linera applications,
 * handling queries and mutations with proper error handling.
 */

import type { Application } from '@linera/client';
import type { ApplicationClient } from './types';
import { logger } from '../../utils/logger';

/**
 * Wrapper around Linera Application for cleaner API
 */
export class ApplicationClientImpl implements ApplicationClient {
  readonly appId: string;
  readonly application: Application;
  private canWrite: boolean;
  private faucetUrl: string;

  constructor(
    appId: string,
    application: Application,
    canWrite: boolean,
    faucetUrl: string
  ) {
    this.appId = appId;
    this.application = application;
    this.canWrite = canWrite;
    this.faucetUrl = faucetUrl;
  }

  /**
   * Execute a GraphQL query
   * Works in both read-only and full mode
   */
  async query<T = unknown>(gql: string): Promise<T> {
    try {
      logger.debug(`[ApplicationClient] Querying ${this.appId}:`, gql);
      const result = await this.application.query(gql);
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] Query failed:`, err);
      throw new Error(`Application query failed: ${err.message}`);
    }
  }

  /**
   * Execute a GraphQL mutation
   * Requires full mode (MetaMask connected)
   */
  async mutate<T = unknown>(gql: string): Promise<T> {
    if (!this.canWrite) {
      throw new Error(
        'Mutations require wallet connection. Please connect MetaMask to perform write operations.'
      );
    }

    try {
      logger.debug(`[ApplicationClient] Mutating ${this.appId}:`, gql);
      const result = await this.application.query(gql); // Note: Linera uses query() for mutations too
      return result as T;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[ApplicationClient] Mutation failed:`, err);
      throw new Error(`Application mutation failed: ${err.message}`);
    }
  }

  /**
   * Query any chain by ID via HTTP (no need to claim it)
   * @param chainId - Target chain ID to query
   * @param gql - GraphQL query string
   */
  async queryChain<T = unknown>(chainId: string, gql: string): Promise<T> {
    const endpoint = `${this.faucetUrl}/chains/${chainId}/applications/${this.appId}`;

    try {
      logger.debug(`[ApplicationClient] Querying chain ${chainId}:`, gql);

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
      logger.error(`[ApplicationClient] queryChain failed:`, err);
      throw new Error(`Cross-chain query failed: ${err.message}`);
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
