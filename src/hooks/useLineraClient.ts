/**
 * useLineraClient Hook
 *
 * Main React hook for accessing Linera client functionality
 */

'use client';
import type { Client, Wallet } from '@linera/client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { type ClientState, type ApplicationClient, ClientMode } from '../lib/linera/types';
import { getLineraClientManager } from '../lib/linera/client-manager';
import { logger } from '../utils/logger';

export interface UseLineraClientReturn {
  /** Current client state */
  state: ClientState;

  /**
   * Public client for queries and system operations
   * Always available after initialization (uses temporary signer)
   * Note: For blockchain event subscriptions, use chain.onNotification() on chain instances
   */
  publicClient: Client | null;

  /**
   * Wallet client for user mutations
   * Only available when wallet is connected (uses MetaMask signer)
   * Note: For blockchain event subscriptions, use chain.onNotification() on chain instances
   */
  walletClient: Client | null;

  /** Wallet instance */
  wallet: Wallet | null;

  /** Is client initialized */
  isInitialized: boolean;

  /** Is in read-only mode (guest) */
  isReadOnly: boolean;

  /** Is wallet connected (full mode) */
  isConnected: boolean;

  /** Connected wallet address */
  walletAddress: string | undefined;

  /** Public address (temporary signer) */
  publicAddress: string | undefined;

  /** Public chain ID (always available after init) */
  publicChainId: string | undefined;

  /** Wallet chain ID (only when wallet connected) */
  walletChainId: string | undefined;

  /** Can perform write operations */
  canWrite: boolean;

  /** Any error that occurred */
  error: Error | undefined;

  /** Get application client */
  getApplication: (appId: string) => Promise<ApplicationClient | null>;
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
  const getApplication = useCallback(async (appId: string): Promise<ApplicationClient | null> => {
    if (!clientManager) {
      logger.warn('[useLineraClient] Client manager not initialized');
      return null;
    }
    return clientManager.getApplication(appId);
  }, [clientManager]);




  return useMemo(() => ({
    state,
    publicClient: clientManager?.getPublicClient() || null,
    walletClient: clientManager?.getWalletClient() || null,
    wallet: clientManager?.getWallet() || null,
    isInitialized: state.isInitialized,
    isReadOnly: state.mode === ClientMode.READ_ONLY,
    isConnected: state.mode === ClientMode.FULL,
    walletAddress: state.walletAddress,
    publicAddress: state.publicAddress,
    publicChainId: state.publicChainId,
    walletChainId: state.walletChainId,
    canWrite: clientManager?.canWrite() || false,
    error: state.error,
    getApplication,
  }), [
    // Depend on specific state properties (primitives) not the object itself
    state.mode,
    state.isInitialized,
    state.hasWallet,
    state.walletAddress,
    state.publicAddress,
    state.publicChainId,
    state.walletChainId,
    state.faucetUrl,
    state.error,
    clientManager,
    getApplication,
  ]);
}
