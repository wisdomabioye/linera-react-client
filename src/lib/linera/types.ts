/**
 * Linera Client Types
 *
 * Core type definitions for Linera client management
 */

import type { Client, Wallet, Signer, Application } from '@linera/client';

/**
 * Client operational modes
 */
export enum ClientMode {
  /** Not yet initialized */
  UNINITIALIZED = 'uninitialized',

  /** Read-only mode with temporary wallet (guest) */
  READ_ONLY = 'read_only',

  /** Full mode with MetaMask wallet (authenticated) */
  FULL = 'full',
}

/**
 * Current state of the Linera client
 */
export interface ClientState {
  /** Current operational mode */
  mode: ClientMode;

  /** Whether client is initialized */
  isInitialized: boolean;

  /** Whether a real wallet (MetaMask) is connected */
  hasWallet: boolean;

  /** Connected wallet address (if any) */
  walletAddress?: string;

  /** Claimed chain ID for current wallet */
  chainId?: string;

  /** Faucet URL being used */
  faucetUrl?: string;

  /** Any error that occurred */
  error?: Error;
}

/**
 * Read-only wallet configuration
 */
export interface ReadOnlyWalletConfig {
  /**
   * Use a constant wallet address for all read-only users.
   * This is the most efficient option for read-only access.
   *
   * Recommended values:
   * - Zero address: "0x0000000000000000000000000000000000000000"
   * - Any valid Ethereum address
   *
   * Benefits:
   * - Zero overhead (no wallet creation)
   * - Same chain for all users (faucet can cache)
   * - Predictable and efficient
   *
   * Takes precedence over storage option.
   */
  constantAddress?: string;

  /**
   * Persist temporary wallet in browser storage.
   * Only used if constantAddress is not provided.
   *
   * Options:
   * - 'localStorage': Persists across browser sessions
   * - 'sessionStorage': Persists only during browser session
   * - 'none': Ephemeral, new wallet on each reload
   *
   * @default 'none'
   */
  storage?: 'localStorage' | 'sessionStorage' | 'none';

  /**
   * Custom storage key for persisted wallet
   * @default 'linera_readonly_wallet'
   */
  storageKey?: string;
}

/**
 * Configuration for client initialization
 */
export interface ClientConfig {
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
   */
  readOnlyWallet?: ReadOnlyWalletConfig;
}

/**
 * Application query/mutation wrapper interface
 */
export interface ApplicationClient {
  /** Application ID */
  readonly appId: string;

  /** Underlying Linera application instance */
  readonly application: Application;

  /** Execute a GraphQL query */
  query<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /** Execute a GraphQL mutation (requires full client) */
  mutate<T = unknown>(gql: string, blockHash?: string): Promise<T>;
  
  /**
   * Query any chain by ID via HTTP (no need to claim it)
   * @param chainId - Target chain ID to query
   * @param gql - GraphQL query string
   */
  queryChain<T = unknown>(chainId: string, gql: string): Promise<T>;
}

/**
 * State change callback
 */
export type StateChangeCallback = (state: ClientState) => void;

/**
 * Linera client manager interface
 */
export interface ILineraClientManager {
  /** Get current client state */
  getState(): ClientState;

  /** Get raw Linera client instance */
  getClient(): Client | Promise<Client> | null;

  /** Get current wallet instance */
  getWallet(): Wallet | null;

  /** Initialize in read-only mode */
  initializeReadOnly(): Promise<void>;

  /** Connect MetaMask wallet */
  connectWallet(signer: Signer): Promise<void>;

  /** Disconnect wallet (revert to read-only) */
  disconnectWallet(): Promise<void>;

  /** Switch to different wallet */
  switchWallet(newSigner: Signer): Promise<void>;

  /** Get application interface */
  getApplication(appId: string): Promise<ApplicationClient | null>;

  /** Check if client can perform write operations */
  canWrite(): boolean;

  /** Subscribe to state changes */
  onStateChange(callback: StateChangeCallback): () => void;

  /** Clean up and destroy client */
  destroy(): Promise<void>;
}

/**
 * Re-export Linera types for convenience
 */
export type { Client, Wallet, Signer, Application };
