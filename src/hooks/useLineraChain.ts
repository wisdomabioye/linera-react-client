/**
 * useLineraChain Hook
 *
 * Convenient hook for accessing a specific Linera chain
 */

'use client';

import { useState, useEffect } from 'react';
import type { Chain } from '@linera/client';
import { useLineraClient } from './useLineraClient';
import { logger } from '../utils/logger';

export interface UseLineraChainReturn {
  /** Chain instance */
  chain: Chain | null;

  /** Is chain ready */
  isReady: boolean;

  /** Is loading chain */
  isLoading: boolean;

  /** The chain ID being accessed */
  chainId: string | undefined;
}

/**
 * Hook to access a specific Linera chain
 *
 * @param chainId - Optional chain ID (uses defaultChainId if not provided)
 * @returns Chain instance and helper methods
 *
 * @example
 * ```tsx
 * function ChainInfo() {
 *   // Uses default chain from provider
 *   const { chain, isReady, chainId } = useLineraChain();
 *
 *   // Or specify a specific chain
 *   const { chain } = useLineraChain("chain-id-here");
 *
 *   useEffect(() => {
 *     if (!isReady || !chain) return;
 *
 *     const getApp = async () => {
 *       const app = await chain.application(APP_ID);
 *       // Use app...
 *     };
 *
 *     getApp();
 *   }, [isReady, chain]);
 * }
 * ```
 */
export function useLineraChain(chainId?: string): UseLineraChainReturn {
  const { getChain, isInitialized, defaultChainId } = useLineraClient();
  const [chain, setChain] = useState<Chain | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Determine which chainId to use
  const targetChainId = chainId || defaultChainId;

  // Load chain instance
  useEffect(() => {
    // Don't load if not initialized yet
    if (!isInitialized) {
      return;
    }

    // Require chainId
    if (!targetChainId) {
      logger.warn('[useLineraChain] No chainId provided and no defaultChainId configured');
      setChain(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadChain = async () => {
      try {
        setIsLoading(true);
        // Use cached getChain instead of client.chain()
        const chainInstance = await getChain(targetChainId);

        if (!cancelled) {
          setChain(chainInstance);
          setIsLoading(false);
        }
      } catch (error) {
        logger.error('[useLineraChain] Failed to load chain:', error);
        if (!cancelled) {
          setChain(null);
          setIsLoading(false);
        }
      }
    };

    loadChain();

    return () => {
      cancelled = true;
    };
  }, [targetChainId, getChain, isInitialized]);

  return {
    chain,
    isReady: chain !== null && !isLoading,
    isLoading,
    chainId: targetChainId,
  };
}
