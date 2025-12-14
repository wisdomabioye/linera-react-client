/**
 * useApplication Hook
 *
 * Convenient hook for accessing a specific Linera application
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ApplicationClient } from '../lib/linera/types';
import { useLineraClient } from './useLineraClient';
import { logger } from '../utils/logger';

export interface UseLineraApplicationReturn {
  /** Application client */
  app: ApplicationClient | null;

  /** Is client ready */
  isReady: boolean;

  /** Is loading application */
  isLoading: boolean;

  /** Can perform write operations */
  canWrite: boolean;

  /**
   * @deprecated Use app.publicClient.query() instead for queries.
   * Execute a query on the current chain
   */
  query: <T = unknown>(gql: string, blockHash?: string) => Promise<T>;

  /**
   * @deprecated Use app.publicClient.systemMutate() for system operations or app.walletClient.mutate() for user operations.
   * Execute a mutation on the current chain
   */
  mutate: <T = unknown>(gql: string, blockHash?: string) => Promise<T>;

  /**
   * @deprecated Use app.publicClient.queryChain() instead for cross-chain queries.
   * Query any chain by ID (cross-chain query)
   */
  queryChain: <T = unknown>(chainId: string, gql: string) => Promise<T>;
}

/**
 * Hook to access a specific Linera application
 *
 * @param appId - The application ID
 * @returns Application client and helper methods
 *
 * @example
 * ```tsx
 * function AuctionList() {
 *   const { app, isReady, query, mutate, canWrite } = useApplication(FAIRDROP_APP_ID);
 *
 *   useEffect(() => {
 *     if (!isReady) return;
 *
 *     const fetchAuctions = async () => {
 *       const auctions = await query('{ "query": "query { auctions }" }');
 *       setAuctions(auctions);
 *     };
 *
 *     fetchAuctions();
 *   }, [isReady, query]);
 *
 *   const handleBid = async () => {
 *     if (!canWrite) {
 *       // Prompt user to connect wallet
 *       return;
 *     }
 *     await mutate('{ "query": "mutation { placeBid(amount: 100) }" }');
 *   };
 * }
 * ```
 */
export function useLineraApplication(appId: string): UseLineraApplicationReturn {
  const { getApplication, isInitialized, canWrite } = useLineraClient();
  const [app, setApp] = useState<ApplicationClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load application instance
  useEffect(() => {
    // Don't load if not initialized yet
    if (!isInitialized) {
      return;
    }

    let cancelled = false;

    const loadApp = async () => {
      try {
        setIsLoading(true);
        const appInstance = await getApplication(appId);

        if (!cancelled) {
          setApp(appInstance);
          setIsLoading(false);
        }
      } catch (error) {
        logger.error('[useApplication] Failed to load application:', error);
        if (!cancelled) {
          setApp(null);
          setIsLoading(false);
        }
      }
    };

    loadApp();

    return () => {
      cancelled = true;
    };
  }, [appId, getApplication, isInitialized, canWrite]); // Re-load when canWrite changes

  const query = useCallback(async <T = unknown>(gql: string, blockHash?: string): Promise<T> => {
    if (!app) {
      throw new Error('Application not initialized. Ensure Linera client is ready.');
    }
    return app.query<T>(gql, blockHash);
  }, [app]);

  const mutate = useCallback(async <T = unknown>(gql: string, blockHash?: string): Promise<T> => {
    if (!app) {
      throw new Error('Application not initialized. Ensure Linera client is ready.');
    }
    return app.mutate<T>(gql, blockHash);
  }, [app]);

  const queryChain = useCallback(async <T = unknown>(chainId: string, gql: string): Promise<T> => {
    if (!app) {
      throw new Error('Application not initialized. Ensure Linera client is ready.');
    }
    return app.queryChain<T>(chainId, gql);
  }, [app]);

  return {
    app,
    isReady: app !== null && !isLoading,
    isLoading,
    canWrite,
    queryChain,
    query,
    mutate,
  };
}
