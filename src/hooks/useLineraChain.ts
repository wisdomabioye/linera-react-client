/**
 * useLineraChain Hook
 *
 * Hook for accessing a specific Linera chain instance
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Chain } from '@linera/client';
import { useLineraClient } from './useLineraClient';
import { getLineraClientManager } from '@/lib/linera';
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
    // Don't load if not initialized yet
    if (!isInitialized || !publicClient) {
      setIsLoading(true);
      return;
    }

    // Validate chainId
    if (!chainId || chainId.trim() === '') {
      const err = new Error('chainId is required and cannot be empty');
      logger.error('[useLineraChain]', err);
      setError(err);
      setChain(null);
      setIsLoading(false);
      return;
    }

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
  return useMemo(() => ({
    chain,
    isReady: chain !== null && !isLoading && !error,
    isLoading,
    error,
    chainId,
  }), [chain, isLoading, error, chainId]);
}
