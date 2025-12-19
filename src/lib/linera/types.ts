/**
 * Linera Client Types
 *
 * Core type definitions for Linera client management
 */

import type { Client, Faucet, Wallet, Signer, Application } from '@linera/client';

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
   * Wallet chain ID - only when wallet is connected
   * Used for paying gas fees on mutations
   */
  walletChainId?: string;

  /** Default chain ID for queries (if configured) */
  defaultChainId?: string;

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

  /**
   * Default chain ID for application queries
   * Optional - if provided, getApplication(appId) will use this chain
   * If not provided, chainId must be specified in each getApplication call
   */
  defaultChainId?: string;

  /** Network environment */
  network?: 'mainnet' | 'testnet' | 'local';

  /** Whether to automatically connect MetaMask on init */
  autoConnect?: boolean;

  /** Skip processing inbox on client creation */
  skipProcessInbox?: boolean;
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
 * Application client interface for interacting with Linera applications
 */
export interface ApplicationClient {
  /** Application ID */
  readonly appId: string;

  /** Chain ID being queried */
  readonly chainId: string;

  /**
   * Execute GraphQL query on the application chain
   * Queries are free and don't require a wallet
   */
  query<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /**
   * Query any chain by ID via HTTP
   * Useful for cross-chain queries
   */
  queryChain<T = unknown>(chainId: string, gql: string): Promise<T>;

  /**
   * Execute mutation on the application
   * Requires connected wallet to sign and pay gas fees
   * @throws Error if wallet is not connected
   */
  mutate<T = unknown>(gql: string, blockHash?: string): Promise<T>;

  /**
   * Get connected wallet address (if wallet is connected)
   */
  getWalletAddress(): string | undefined;

  /**
   * Get wallet chain ID (if wallet is connected)
   */
  getWalletChainId(): string | undefined;

  /**
   * Check if wallet is connected and mutations are possible
   */
  canMutate(): boolean;
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

  /** Initialize client (loads WASM module) */
  initialize(): Promise<void>;

  /** Connect MetaMask wallet */
  connectWallet(signer: Signer): Promise<void>;

  /** Disconnect wallet */
  disconnectWallet(): Promise<void>;

  /** Switch to different wallet */
  switchWallet(newSigner: Signer): Promise<void>;

  /**
   * Get application interface
   * @param appId - Application ID
   * @param chainId - Optional chain ID (uses defaultChainId if not provided)
   */
  getApplication(appId: string, chainId?: string): Promise<ApplicationClient | null>;

  /** Check if client can perform write operations */
  canWrite(): boolean;

  /** Subscribe to state changes */
  onStateChange(callback: StateChangeCallback): () => void;

  /** Clean up and destroy client */
  destroy(): Promise<void>;

  /**
   * Reinitialize client, useful when 'runtime' error occur
   */
  reinit(): Promise<void>;
}



/**
 * Linera WASM Module Types
 *
 * Type definitions for the Linera WebAssembly module loaded from public/linera/
 * These types match the interface defined in public/linera/linera_web.d.ts
 */

/**
 * Client constructor signature
 */
export interface ClientConstructor {
  new (wallet: Wallet, signer: Signer, skip_process_inbox: boolean): Client;
}

/**
 * Faucet constructor signature
 */
export interface FaucetConstructor {
  new (url: string): Faucet;
}

/**
 * WASM initialization function
 */
export type InitFunction = (module_or_path?: string, memory?: WebAssembly.Memory) => Promise<unknown>;

/**
 * Complete Linera WASM module interface
 */
export interface LineraModule {
  /** WASM initialization function (default export) */
  default: InitFunction;

  /** Client constructor */
  Client: ClientConstructor;

  /** Faucet constructor */
  Faucet: FaucetConstructor;

  /** Application class (not directly constructed, obtained from Frontend) */
  Application: Application;

  /** Wallet class (not directly constructed, obtained from Faucet) */
  Wallet: Wallet;

  /** Signer interface (implemented by user) */
  Signer: Signer;

  /** Main entry point */
  main(): void;

  /** Web worker entry point */
  wasm_thread_entry_point(ptr: number): Promise<void>;
}


/**
 * Re-export Linera types for convenience
 */
export type { Client, Wallet, Signer, Application };
