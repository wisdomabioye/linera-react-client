/**
 * useApplication Hook
 *
 * Convenient hook for accessing a specific Linera application
 */

'use client';

import { useState, useEffect } from 'react';
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
}

/**
 * Hook to access a specific Linera application
 *
 * @param appId - The application ID
 * @param chainId - Optional chain ID (uses defaultChainId if not provided)
 * @returns Application client and helper methods
 *
 * @example
 * ```tsx
 * function AuctionList() {
 *   // Uses default chain from provider
 *   const { app, isReady, canWrite } = useLineraApplication(FAIRDROP_APP_ID);
 *
 *   // Or specify a specific chain
 *   const { app } = useLineraApplication(FAIRDROP_APP_ID, "chain-id-here");
 *
 *   useEffect(() => {
 *     if (!isReady || !app) return;
 *
 *     const fetchAuctions = async () => {
 *       const auctions = await app.query('{ "query": "query { auctions }" }');
 *       setAuctions(auctions);
 *     };
 *
 *     fetchAuctions();
 *   }, [isReady, app]);
 *
 *   const handleBid = async () => {
 *     if (!canWrite || !app) {
 *       // Prompt user to connect wallet
 *       return;
 *     }
 *     await app.mutate('{ "query": "mutation { placeBid(amount: 100) }" }');
 *   };
 * }
 * ```
 */
export function useLineraApplication(appId: string, chainId?: string): UseLineraApplicationReturn {
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
        const appInstance = await getApplication(appId, chainId);

        if (!cancelled) {
          setApp(appInstance);
          setIsLoading(false);
        }
      } catch (error) {
        logger.error('[useLineraApplication] Failed to load application:', error);
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
  }, [appId, chainId, getApplication, isInitialized, canWrite]); // Re-load when canWrite changes

  return {
    app,
    isReady: app !== null && !isLoading,
    isLoading,
    canWrite
  };
}
