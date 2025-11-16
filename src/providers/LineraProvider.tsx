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

  /**
   * Custom fallback UI shown during initialization
   * If not provided, shows default loading message
   *
   * @example
   * fallback={<AppSkeleton />}
   */
  fallback?: React.ReactNode;

  /**
   * Custom error UI shown when initialization fails
   * If not provided, shows default error with reload button
   *
   * @example
   * errorFallback={(error) => <ErrorBoundary error={error} />}
   */
  errorFallback?: (error: Error) => React.ReactNode;

  /**
   * Immediate mode - render children immediately without waiting for initialization
   * WARNING: Components must check isInitialized before using Linera to avoid WASM errors
   *
   * @default false
   *
   * @example
   * <LineraProvider faucetUrl="..." immediate>
   *   <App /> // Must check isInitialized in components
   * </LineraProvider>
   */
  immediate?: boolean;
}

/**
 * Provider that initializes Linera client on mount
 *
 * @example
 * ```tsx
 * // Example 1: Default - blocks until initialized
 * <LineraProvider faucetUrl="http://localhost:8080">
 *   <App />
 * </LineraProvider>
 *
 * // Example 2: Custom fallback during initialization
 * <LineraProvider
 *   faucetUrl="http://localhost:8080"
 *   fallback={<AppSkeleton />}
 * >
 *   <App />
 * </LineraProvider>
 *
 * // Example 3: Immediate mode (advanced - requires checking isInitialized)
 * <LineraProvider faucetUrl="http://localhost:8080" immediate>
 *   <App /> // Must check isInitialized in components
 * </LineraProvider>
 *
 * // Example 4: Custom error handling
 * <LineraProvider
 *   faucetUrl="http://localhost:8080"
 *   errorFallback={(error) => <ErrorPage error={error} />}
 * >
 *   <App />
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
  fallback,
  errorFallback,
  immediate = false,
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

  // Immediate mode: render children immediately (advanced users only)
  if (immediate) {
    return <>{children}</>;
  }

  // Error state
  if (error) {
    // Custom error component
    if (errorFallback) {
      return <>{errorFallback(error)}</>;
    }

    // Default error UI
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <h2>Linera Initialization Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  // Loading state
  if (!isInitialized) {
    // Custom fallback
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default loading UI
    return (
      <div style={{ padding: '20px' }}>
        <p>Initializing Linera client...</p>
      </div>
    );
  }

  // Initialized: render children
  return <>{children}</>;
}
