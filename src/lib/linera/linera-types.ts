/**
 * Linera WASM Module Types
 *
 * Type definitions for the Linera WebAssembly module loaded from public/linera/
 * These types match the interface defined in public/linera/linera_web.d.ts
 */

/**
 * Signer interface for signing and key management compatible with Ethereum (EVM) addresses
 */
export interface Signer {
  sign(owner: string, value: Uint8Array): Promise<string>;
  containsKey(owner: string): Promise<boolean>;
}

/**
 * Application class for querying Linera applications
 */
export interface Application {
  free(): void;
  query(query: string, block_hash?: string | null): Promise<string>;
}

/**
 * Wallet that stores the user's chains and keys
 */
export interface Wallet {
  free(): void;
}

/**
 * Client API for interacting with the Linera network
 */
export interface Client {
  free(): void;
  onNotification(handler: (...args: unknown[]) => unknown): void;
  // eslint-disable-next-line
  transfer(options: any): Promise<void>;
  balance(): Promise<string>;
  // eslint-disable-next-line
  identity(): Promise<any>;
  frontend(): Frontend;
}

/**
 * Client constructor signature
 */
export interface ClientConstructor {
  new (wallet: Wallet, signer: Signer, skip_process_inbox: boolean): Client;
}

/**
 * Frontend API exposed to application frontends
 */
export interface Frontend {
  free(): void;
  validatorVersionInfo(): Promise<unknown>;
  application(id: string): Promise<Application>;
}

/**
 * Faucet for creating wallets and claiming chains
 */
export interface Faucet {
  free(): void;
  createWallet(): Promise<Wallet>;
  claimChain(wallet: Wallet, owner: string): Promise<string>;
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

  /** Frontend class (not directly constructed, obtained from Client) */
  Frontend: Frontend;

  /** Signer interface (implemented by user) */
  Signer: Signer;

  /** Main entry point */
  main(): void;

  /** Web worker entry point */
  wasm_thread_entry_point(ptr: number): Promise<void>;
}
