/**
 * useLineraClient Hook
 *
 * Main React hook for accessing Linera client functionality
 */

'use client';
import type { Wallet, Client } from '@linera/client';
import { type ClientState, type ApplicationClient, ClientMode } from '../lib/linera/types';
import { useState, useEffect, useCallback } from 'react';
import { getLineraClientManager } from '../lib/linera/client-manager';
import { logger } from '../utils/logger';

export interface UseLineraClientReturn {
  /** Current client state */
  state: ClientState;

  /** Base Linera client for low-level access */
  client: Client | null;

  /** Wallet instance */
  wallet: Wallet | null;

  /** Is client initialized */
  isInitialized: boolean;

  /** Is in read-only mode (no wallet) */
  isReadOnly: boolean;

  /** Is wallet connected (full mode) */
  isConnected: boolean;

  /** Connected wallet address */
  walletAddress: string | undefined;

  /** Wallet chain ID (only when wallet connected) */
  walletChainId: string | undefined;

  /** Default chain ID for queries (if configured) */
  defaultChainId: string | undefined;

  /** Can perform write operations */
  canWrite: boolean;

  /** Any error that occurred */
  error: Error | undefined;

  /** Get application client */
  getApplication: (appId: string, chainId?: string) => Promise<ApplicationClient | null>;
}

/**
 * Hook to access the Linera client
 *
 * The client must be initialized separately (usually in a provider or layout)
 * before using this hook.
 */
export function useLineraClient(): UseLineraClientReturn {
  const clientManager = getLineraClientManager();

  const [state, setState] = useState<ClientState>(() => {
    // Get initial state from client manager if available
    const manager = getLineraClientManager();
    return manager?.getState() || {
      mode: ClientMode.UNINITIALIZED,
      isInitialized: false,
      hasWallet: false,
    };
  });

  // Subscribe to state changes
  useEffect(() => {
    if (!clientManager) return;

    // Sync state immediately to avoid race condition
    setState(clientManager.getState());

    // Subscribe to future changes
    const unsubscribe = clientManager.onStateChange((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [clientManager]);

  // Get application client
  const getApplication = useCallback(async (appId: string, chainId?: string): Promise<ApplicationClient | null> => {
    if (!clientManager) {
      logger.warn('[useLineraClient] Client manager not initialized');
      return null;
    }
    return clientManager.getApplication(appId, chainId);
  }, [clientManager]);

  return {
    state,
    client: clientManager?.getClient() || null,
    wallet: clientManager?.getWallet() || null,
    isInitialized: state.isInitialized,
    isReadOnly: state.mode === ClientMode.READ_ONLY,
    isConnected: state.mode === ClientMode.FULL,
    walletAddress: state.walletAddress,
    walletChainId: state.walletChainId,
    defaultChainId: state.defaultChainId,
    canWrite: clientManager?.canWrite() || false,
    error: state.error,
    getApplication,
  };
}
