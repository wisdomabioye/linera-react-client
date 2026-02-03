/**
 * useLineraChain Hook
 *
 * Hook for accessing a specific Linera chain instance
 */

'use client';

import type { Chain } from '@linera/client';
import { useState, useEffect, useMemo } from 'react';
import { useLineraClient } from './useLineraClient';
import { getLineraClientManager } from '../lib/linera';
import { logger } from '../utils/logger';

export interface UseLineraChainReturn {
  /** Chain instance (cached) */
  chain: Chain | null;

  /** Is chain ready */
  isReady: boolean;

  /** Is loading chain */
  isLoading: boolean;

  /** Error if any */
  error: Error | null;

  /** The chain ID being accessed */
  chainId: string;
}

/**
 * Hook to access a specific Linera chain
 *
 * Uses efficient caching via client manager's getChain() method
 *
 * @param chainId - Explicit chain ID (required)
 * @returns Chain instance and status
 *
 * @example
 * ```tsx
 * function ChainInfo() {
 *   const { chain, isReady, error } = useLineraChain("e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65");
 *
 *   if (!isReady) return <div>Loading chain...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return <div>Chain loaded!</div>;
 * }
 * ```
 */
export function useLineraChain(chainId: string): UseLineraChainReturn {
  const { isInitialized, publicClient } = useLineraClient();
  const [chain, setChain] = useState<Chain | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Early returns for "not applicable" states
    if (!isInitialized || !publicClient) return;
    if (!chainId || chainId.trim() === '') return;

    let cancelled = false;

    const loadChain = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use client manager's cached getChain
        const clientManager = getLineraClientManager();
        if (!clientManager) {
          throw new Error('Client manager not available');
        }

        const chainInstance = await clientManager.getChain(chainId);

        if (!cancelled) {
          setChain(chainInstance);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('[useLineraChain] Failed to load chain:', error);
        if (!cancelled) {
          setChain(null);
          setError(error);
          setIsLoading(false);
        }
      }
    };

    loadChain();

    return () => {
      cancelled = true;
    };
  }, [chainId, isInitialized, publicClient]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => {
    // Handle "not applicable" state - chainId is empty
    if (!chainId || chainId.trim() === '') {
      return {
        chain: null,
        isReady: false,
        isLoading: false,
        error: null,
        chainId,
      };
    }

    return {
      chain,
      isReady: chain !== null && !isLoading && !error,
      isLoading,
      error,
      chainId,
    };
  }, [chain, isLoading, error, chainId]);
}
