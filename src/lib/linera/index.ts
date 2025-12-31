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

export { ApplicationClientImpl, ChainApplicationClient } from './application-client';
export { TemporarySigner } from './temporary-signer';

// Type exports
export {
  ClientMode,
  type ClientState,
  type ClientConfig,
  type ReadOnlyWalletConfig,
  type ApplicationClient,
  type PublicApp,
  type WalletApp,
  type ChainApp,
  type StateChangeCallback,
  type ILineraClientManager,
  type Client,
  type Wallet,
  type Signer,
  type Application,
} from './types';