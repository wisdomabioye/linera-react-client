import { vi } from 'vitest';

// Mock implementations
export const mockInit = vi.fn().mockResolvedValue(undefined);
export const mockCreateWallet = vi.fn().mockResolvedValue({
  free: vi.fn(),
});
export const mockClaimChain = vi.fn().mockResolvedValue('mock-chain-id');
export const mockQuery = vi.fn().mockResolvedValue({ data: 'mock-data' });
export const mockChain = vi.fn().mockResolvedValue({
  application: vi.fn().mockResolvedValue({
    query: mockQuery,
  }),
});

// Mock classes
export class Client {
  constructor(public wallet: any, public signer: any, public skipProcessInbox: boolean) {}
  chain = mockChain;
  free = vi.fn();
}

export class Wallet {
  free = vi.fn();
}

export class Faucet {
  constructor(public url: string) {}
  createWallet = mockCreateWallet;
  claimChain = mockClaimChain;
}

export interface Signer {
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface Application {
  query(gql: string, options?: any): Promise<any>;
}

// Default export (WASM init function)
export default mockInit;
