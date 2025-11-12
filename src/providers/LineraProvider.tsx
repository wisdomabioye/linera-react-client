/**
 * Linera Provider
 *
 * Initializes the Linera client at app startup
 */

'use client';

import { useEffect, useState } from 'react';
import { createLineraClient } from '../lib/linera';
import type { ReadOnlyWalletConfig } from '../lib/linera/types';
import { createLogger, logger, type LoggerConfig } from '../utils/logger';

export interface LineraProviderProps {
  children: React.ReactNode;

  /** Linera faucet endpoint URL */
  faucetUrl: string;

  /** Network environment */
  network?: 'mainnet' | 'testnet' | 'local';

  /** Whether to automatically connect MetaMask on init */
  autoConnect?: boolean;

  /** Skip processing inbox on client creation */
  skipProcessInbox?: boolean;

  /**
   * Read-only wallet configuration
   * Controls how temporary wallets are created for guest/read-only mode
   *
   * @example
   * // Use constant address (recommended - most efficient)
   * readOnlyWallet={{
   *   constantAddress: "0x0000000000000000000000000000000000000000"
   * }}
   *
   * @example
   * // Persist in localStorage
   * readOnlyWallet={{
   *   storage: 'localStorage'
   * }}
   */
  readOnlyWallet?: ReadOnlyWalletConfig;

  /**
   * Logging configuration
   *
   * @example
   * // Disable logging entirely
   * logging={false}
   *
   * @example
   * // Enable with custom level
   * logging={{ enabled: true, level: LogLevel.INFO }}
   *
   * @example
   * // Use custom logger (e.g., Sentry)
   * logging={{
   *   customLogger: {
   *     debug: (...args) => console.debug(...args),
   *     info: (...args) => myLogger.info(...args),
   *     warn: (...args) => myLogger.warn(...args),
   *     error: (...args) => Sentry.captureException(...args)
   *   }
   * }}
   *
   * @default true in development, false in production
   */
  logging?: boolean | LoggerConfig;
}

/**
 * Provider that initializes Linera client on mount
 *
 * @example
 * ```tsx
 * // Example 1: Constant address (recommended - most efficient)
 * <LineraProvider
 *   faucetUrl="http://localhost:8080"
 *   readOnlyWallet={{ constantAddress: "0x0000000000000000000000000000000000000000" }}
 * >
 *   {children}
 * </LineraProvider>
 *
 * // Example 2: Persisted in localStorage
 * <LineraProvider
 *   faucetUrl="http://localhost:8080"
 *   readOnlyWallet={{ storage: 'localStorage' }}
 * >
 *   {children}
 * </LineraProvider>
 *
 * // Example 3: Ephemeral (default - new wallet each reload)
 * <LineraProvider faucetUrl="http://localhost:8080">
 *   {children}
 * </LineraProvider>
 * ```
 */
export function LineraProvider({
  children,
  faucetUrl,
  network = 'testnet',
  autoConnect = false,
  skipProcessInbox,
  readOnlyWallet,
  logging,
}: LineraProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize logger on mount
  useEffect(() => {
    if (typeof logging === 'boolean') {
      createLogger({ enabled: logging });
    } else if (logging) {
      createLogger(logging);
    } else {
      // Initialize with default configuration
      createLogger();
    }
  }, [logging]);

  useEffect(() => {
    const initClient = async () => {
      try {
        logger.info('Initializing client...');

        // Create client manager
        const clientManager = createLineraClient({
          faucetUrl,
          network,
          autoConnect,
          skipProcessInbox,
          readOnlyWallet,
        });

        // Initialize in read-only mode
        await clientManager.initializeReadOnly();

        setIsInitialized(true);
        logger.info('Client initialized successfully');
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Initialization failed:', error);
        setError(error);
      }
    };

    initClient();
  }, [faucetUrl, network, autoConnect, skipProcessInbox, readOnlyWallet]);

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Linera Initialization Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div style={{ padding: '20px' }}>
        <p>Initializing Linera client...</p>
      </div>
    );
  }

  return <>{children}</>;
}
