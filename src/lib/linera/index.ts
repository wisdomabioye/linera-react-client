/**
 * Linera Client Library
 *
 * Main entry point for Linera blockchain integration
 */

// Core exports
export {
  LineraClientManager,
  createLineraClient,
  getLineraClientManager,
  resetLineraClientManager,
} from './client-manager';

export { ApplicationClientImpl } from './application-client';
export { TemporarySigner } from './temporary-signer';

// Type exports
export {
  ClientMode,
  type ClientState,
  type ClientConfig,
  type ReadOnlyWalletConfig,
  type ApplicationClient,
  type StateChangeCallback,
  type ILineraClientManager,
  type Client,
  type Wallet,
  type Signer,
  type Application,
} from './types';

// Linera WASM module types
export type {
  LineraModule,
  ClientConstructor,
  FaucetConstructor,
  Frontend,
  InitFunction,
} from './linera-types';
