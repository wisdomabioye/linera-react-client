/**
 * useWalletConnection Hook
 *
 * Manages MetaMask wallet connection with Linera client
 */

'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { MetaMaskSigner, isMetaMaskInstalled } from '../lib/signers/metamask-signer';
import { getLineraClientManager } from '../lib/linera/client-manager';
import { useLineraClient } from './useLineraClient';
import { logger } from '../utils/logger';

export interface UseWalletConnectionReturn {
  /** Is MetaMask installed */
  isMetaMaskInstalled: boolean;

  /** Is wallet connected */
  isConnected: boolean;

  /** Is connecting */
  isConnecting: boolean;

  /** Connected wallet address */
  address: string | undefined;

  /** Connection error */
  error: Error | undefined;

  /** Connect MetaMask wallet */
  connect: () => Promise<void>;

  /** Disconnect wallet */
  disconnect: () => Promise<void>;
}

/**
 * Hook to manage wallet connection
 *
 * @example
 * ```tsx
 * function WalletButton() {
 *   const { isConnected, connect, disconnect, address } = useWalletConnection();
 *
 *   if (isConnected) {
 *     return (
 *       <button onClick={disconnect}>
 *         Disconnect {address?.slice(0, 6)}...
 *       </button>
 *     );
 *   }
 *
 *   return <button onClick={connect}>Connect Wallet</button>;
 * }
 * ```
 */
export function useWalletConnection(): UseWalletConnectionReturn {
  const clientManager = getLineraClientManager();
  const { isConnected, walletAddress, error: clientError } = useLineraClient();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | undefined>(clientError);

  /**
   * Connect MetaMask wallet
   */
  const connect = useCallback(async () => {
    if (!clientManager) {
      setError(new Error('Client manager not initialized'));
      return;
    }

    if (!isMetaMaskInstalled()) {
      setError(new Error('MetaMask is not installed. Please install MetaMask to continue.'));
      return;
    }

    try {
      setIsConnecting(true);
      setError(undefined);

      // Create MetaMask signer
      const signer = new MetaMaskSigner();

      // Connect wallet through client manager
      await clientManager.connectWallet(signer);

      logger.info('[useWalletConnection] Wallet connected successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[useWalletConnection] Connection failed:', error);
      setError(error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [clientManager]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    if (!clientManager) {
      setError(new Error('Client manager not initialized'));
      return;
    }

    try {
      setIsConnecting(true);
      setError(undefined);

      await clientManager.disconnectWallet();

      logger.info('[useWalletConnection] Wallet disconnected');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[useWalletConnection] Disconnect failed:', error);
      setError(error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [clientManager]);

  // Use ref to access latest disconnect without adding to effect deps
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;

  /**
   * Listen for MetaMask account changes
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return;

    const handleAccountsChanged = async (accounts: unknown) => {
      const accountList = accounts as string[];

      if (!clientManager) return;

      if (accountList.length === 0) {
        // User disconnected all accounts
        logger.info('[useWalletConnection] MetaMask accounts disconnected');
        await disconnectRef.current();
      } else if (isConnected) {
        // Account switched
        logger.info('[useWalletConnection] MetaMask account changed, switching wallet...');
        try {
          const newSigner = new MetaMaskSigner();
          await clientManager.switchWallet(newSigner);
        } catch (err) {
          logger.error('[useWalletConnection] Failed to switch wallet:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [isConnected, clientManager]);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => ({
    isMetaMaskInstalled: isMetaMaskInstalled(),
    isConnected,
    isConnecting,
    address: walletAddress,
    error,
    connect,
    disconnect,
  }), [isConnected, isConnecting, walletAddress, error, connect, disconnect]);
}
