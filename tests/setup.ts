import '@testing-library/jest-dom';
import { afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock the temporary signer module
vi.mock('@/lib/linera/temporary-signer', () => ({
  TemporarySigner: vi.fn().mockImplementation(() => ({
    address: vi.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
    sign: vi.fn().mockResolvedValue('0xmocksignature'),
    containsKey: vi.fn().mockResolvedValue(true),
    getPrivateKey: vi.fn().mockReturnValue('0xmockprivatekey'),
    clearStorage: vi.fn(),
  })),
}));

// Mock browser environment for WASM loading
vi.mock('happy-dom', () => ({
  Window: class MockWindow {
    location = {
      origin: 'http://localhost:3000',
      reload: vi.fn(),
    };
  },
}));

// Mock the dynamic import for WASM loading
const mockLineraModule = {
  Client: vi.fn().mockImplementation((wallet, signer, options) => ({
    chain: vi.fn().mockResolvedValue({
      application: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ data: 'mock-data' }),
      }),
    }),
    free: vi.fn(),
  })),
  Wallet: vi.fn().mockImplementation(() => ({
    free: vi.fn(),
  })),
  Faucet: vi.fn().mockImplementation((url) => ({
    createWallet: vi.fn().mockResolvedValue({ free: vi.fn() }),
    claimChain: vi.fn().mockResolvedValue('mock-chain-id'),
  })),
  initialize: vi.fn().mockResolvedValue(undefined),
};

vi.mock('node:module', () => ({
  createRequire: vi.fn(),
}));

// Mock the Function constructor used for dynamic imports
const originalFunction = global.Function;
global.Function = vi.fn().mockImplementation((...args) => {
  if (args[0] === 'url' && args[1] === 'return import(url)') {
    return vi.fn().mockResolvedValue(mockLineraModule);
  }
  return originalFunction(...args);
});

// Suppress console errors and warnings during tests
beforeAll(() => {
  global.console = {
    ...console,
    error: vi.fn(),
    warn: vi.fn(),
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Ensure window is available in tests
Object.defineProperty(global, 'window', {
  value: {
    location: {
      origin: 'http://localhost:3000',
      reload: vi.fn(),
    },
  },
  writable: true,
});
