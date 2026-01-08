/**
 * useChainApplication Hook
 *
 * Hook for accessing a specific application on a specific chain
 * Provides WalletApp-like interface for standalone chain applications
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ChainApp } from '../lib/linera/types';
import { getLineraClientManager } from '../lib/linera';
import { useLineraClient } from './useLineraClient';
import { logger } from '../utils/logger';

export interface UseChainApplicationReturn {
  /** Chain application client with WalletApp-like interface */
  app: ChainApp | null;

  /** Is application ready */
  isReady: boolean;

  /** Is loading application */
  isLoading: boolean;

  /** Error if any */
  error: Error | null;

  /** The chain ID being accessed */
  chainId: string;

  /** The application ID being accessed */
  appId: string;
}

/**
 * Hook to access a specific application on a specific chain
 * Provides a WalletApp-like interface (query, mutate, getAddress, getChainId)
 *
 * @param chainId - Chain ID to load application from
 * @param appId - Application ID
 * @returns Chain application client and status
 *
 * @example
 * ```tsx
 * function ChainAppComponent() {
 *   const { app, isReady, error } = useChainApplication(
 *     "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65",
 *     "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000"
 *   );
 *
 *   if (!isReady) return <div>Loading application...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const handleQuery = async () => {
 *     const result = await app.query('{ myQuery }');
 *     console.log(result);
 *   };
 *
 *   const handleMutation = async () => {
 *     await app.mutate('{ myMutation }');
 *   };
 *
 *   return (
 *     <div>
 *       <p>Chain: {app.getChainId()}</p>
 *       <p>Address: {app.getAddress()}</p>
 *       <button onClick={handleQuery}>Query</button>
 *       <button onClick={handleMutation}>Mutate</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChainApplication(
  chainId: string,
  appId: string
): UseChainApplicationReturn {
  const { isInitialized } = useLineraClient();
  const [app, setApp] = useState<ChainApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Early returns for "not applicable" states
    if (!isInitialized) return;
    if (!chainId || chainId.trim() === '') return;
    if (!appId || appId.trim() === '') return;

    let cancelled = false;

    const loadChainApp = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use client manager's getChainApplication (leverages chain cache)
        const clientManager = getLineraClientManager();
        if (!clientManager) {
          throw new Error('Client manager not available');
        }

        const chainApp = await clientManager.getChainApplication(chainId, appId);

        if (!chainApp) {
          throw new Error('Failed to load chain application');
        }

        if (!cancelled) {
          setApp(chainApp);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('[useChainApplication] Failed to load chain application:', error);
        if (!cancelled) {
          setApp(null);
          setError(error);
          setIsLoading(false);
        }
      }
    };

    loadChainApp();

    return () => {
      cancelled = true;
    };
  }, [chainId, appId, isInitialized]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => {
    // Handle "not applicable" state - chainId or appId is empty
    if (!chainId || chainId.trim() === '' || !appId || appId.trim() === '') {
      return {
        app: null,
        isReady: false,
        isLoading: false,
        error: null,
        chainId,
        appId,
      };
    }

    return {
      app,
      isReady: app !== null && !isLoading && !error,
      isLoading,
      error,
      chainId,
      appId,
    };
  }, [app, isLoading, error, chainId, appId]);
}
