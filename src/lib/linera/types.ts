/**
 * Linera Client Types
 *
 * Core type definitions for Linera client management
 */

import type { Client, Wallet, Signer, Application, Chain, Faucet, QueryOptions, initialize, Options as ClientOptions, signer} from '@linera/client';

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
  
  /**
   * Read-only wallet configuration
   * Controls how temporary wallets are created for guest/read-only mode
   * 
   * In Provider:
   * 
   *
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
   * @linera/client config 
   * this is passed directly to the client init function
   */
  init: ClientOptions
}

/**
 * Public app interface - operations that don't require user wallet
 */
export interface PublicApp {
  /** Execute GraphQL query on public chain */
  query<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;

  /** Get connected public address */
  getAddress(): string;

  /** Get public chain ID */
  getChainId(): string;

  /** Execute system mutations (auto-signed with temporary wallet, no user prompt) */
  systemMutate<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;
}

/**
 * Wallet app interface - operations requiring user wallet
 */
export interface WalletApp {
  /** Execute GraphQL query on wallet chain */
  query<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;

  /** Get connected wallet address */
  getAddress(): string;

  /** Get wallet chain ID */
  getChainId(): string;

  /** Execute user mutations (requires wallet signature) */
  mutate<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;
}

/**
 * Chain app interface - operations on a standalone chain
 * Similar to WalletApp but for arbitrary chains accessed via getChain()
 */
export interface ChainApp {
  /** Execute GraphQL query on the chain */
  query<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;

  /** Get chain owner address */
  getAddress(): string;

  /** Get chain ID */
  getChainId(): string;

  /** Execute mutations on the chain (signed by chain's signer) */
  mutate<T = unknown>(gql: string, options?: QueryOptions): Promise<T>;
}

/**
 * Application query/mutation wrapper interface
 */
export interface ApplicationClient {
  /** Application ID */
  readonly appId: string;

  /**
   * Public application operations (queries and system operations)
   * Always available (uses public chain with temporary signer)
   */
  readonly public: PublicApp;

  /**
   * Wallet application operations (user mutations)
   * Only available when wallet is connected (uses wallet chain)
   */
  readonly wallet?: WalletApp;
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

  /** Get public client (for queries and system operations) */
  getPublicClient(): Client | null;

  /** Get wallet client (for user mutations) */
  getWalletClient(): Client | null;

  /** Get a Linera chain */
  getChain(chainId: string): Promise<Chain>;

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

  /** Get application interface for a specific chain */
  getChainApplication(chainId: string, appId: string): Promise<ChainApp | null>;

  /** Check if client can perform write operations */
  canWrite(): boolean;

  /** Subscribe to state changes */
  onStateChange(callback: StateChangeCallback): () => void;

  /** Clean up and destroy client */
  destroy(): Promise<void>;

  /**
   * reinitialize client, useful when 'runtime' error occur
   */
  // reinit(): Promise<void>;
}

/**
 * Complete Linera WASM module interface
 */
export interface LineraModule {
  /** WASM initialization function (default export) */
  default: typeof initialize;

  /** Client constructor */
  Client: typeof Client;

  /** Faucet constructor */
  Faucet: typeof Faucet;

  /** Application class (not directly constructed, obtained from Frontend) */
  Application: typeof Application;

  /** Wallet class (not directly constructed, obtained from Faucet) */
  Wallet: typeof Wallet;

  /** Signer interface (implemented by user) */
  Signer: typeof Signer;
}

/**
 * Re-export Linera types for convenience
 */
export type { Client, Wallet, Signer, Application };
