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

  /**
   * Public address - temporary address used for public chain
   * Always available after initialization
   */
  publicAddress?: string;

  /**
   * Public chain ID - always available after initialization
   * Used for queries and cross-chain subscriptions
   */
  publicChainId?: string;

  /**
   * Wallet chain ID - only when wallet is connected
   * Used for user mutations
   */
  walletChainId?: string;

  /**
   * @deprecated Use publicChainId or walletChainId instead
   * Returns walletChainId if available, otherwise publicChainId
   */
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
 * Operation type for mutations
 */
export enum OperationType {
  /** Pure read operations (queries) */
  READ = 'read',

  /** System operations auto-signed with temporary wallet (subscriptions, heartbeat) */
  SYSTEM = 'system',

  /** User-initiated operations requiring wallet signature */
  USER = 'user',
}

/**
 * Options for mutation operations
 */
export interface MutateOptions {
  /** Operation type - defaults to USER */
  operationType?: OperationType;

  /** Optional block hash */
  blockHash?: string;
}

/**
 * Public client interface - operations that don't require user wallet
 */
export interface PublicClient {
  /** Execute GraphQL query on public chain */
  query<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /** Query any chain by ID via HTTP */
  queryChain<T = unknown>(chainId: string, gql: string): Promise<T>;

  /** Get connected public address */
  getAddress(): string;

  /** Get public chain ID */
  getChainId(): string;

  /** Execute system mutations (auto-signed with temporary wallet, no user prompt) */
  systemMutate<T = unknown>(gql: string, blockHash?: string): Promise<T>;
}

/**
 * Wallet client interface - operations requiring user wallet
 */
export interface WalletClient extends PublicClient {
  /** Execute user mutations (requires wallet signature) */
  mutate<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /** Get connected wallet address */
  getAddress(): string;

  /** Get wallet chain ID */
  getChainId(): string;
}

/**
 * Application query/mutation wrapper interface
 */
export interface ApplicationClient {
  /** Application ID */
  readonly appId: string;

  /**
   * @deprecated Use publicClient or walletClient instead
   * Underlying Linera application instance (public chain)
   */
  readonly application: Application;

  /**
   * Public client for queries and system operations
   * Always available (uses public chain with temporary signer)
   */
  readonly publicClient: PublicClient;

  /**
   * Wallet client for user mutations
   * Only available when wallet is connected (uses wallet chain)
   */
  readonly walletClient?: WalletClient;

  /**
   * @deprecated Use publicClient.query() instead
   * Execute a GraphQL query
   */
  query<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /**
   * @deprecated Use publicClient.systemMutate() or walletClient.mutate() instead
   * Execute a GraphQL mutation (requires full client or operationType: SYSTEM)
   */
  mutate<T = unknown>(gql: string, options?: MutateOptions | string): Promise<T>;

  /**
   * @deprecated Use publicClient.queryChain() instead
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
