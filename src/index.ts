'use client';

/**
 * Linera React Client
 *
 * A React client library for Linera blockchain with hooks, providers, and wallet management
 */

// React Hooks
export {
  useLineraClient,
  useLineraChain,
  useLineraApplication,
  useChainApplication,
  useWalletConnection,
  type UseLineraClientReturn,
  type UseLineraChainReturn,
  type UseLineraApplicationReturn,
  type UseChainApplicationReturn,
  type UseWalletConnectionReturn,
} from './hooks';

// Provider
export {
  LineraProvider,
  type LineraProviderProps
} from './providers';

// Core Client Library
export {
  LineraClientManager,
  createLineraClient,
  getLineraClientManager,
  resetLineraClientManager,
  ApplicationClientImpl,
  ChainApplicationClient,
  TemporarySigner,
  ClientMode,
  type ClientState,
  type ClientConfig,
  type ReadOnlyWalletConfig,
  type ApplicationClient,
  type ChainApp,
  type StateChangeCallback,
  type ILineraClientManager,
  type Client,
  type Wallet,
  type Signer,
  type Application
} from './lib/linera';

// Signer Options
export type { TemporarySignerOptions } from './lib/linera/temporary-signer';

// Signers
export {
  MetaMaskSigner,
  isMetaMaskInstalled,
} from './lib/signers/metamask-signer';

// Logging
export {
  logger,
  Logger,
  LogLevel,
  createLogger,
  getLogger,
  resetLogger,
  debug,
  info,
  warn,
  error,
  type LoggerConfig,
  type CustomLogger,
} from './utils';
