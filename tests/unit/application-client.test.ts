import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationClientImpl } from '../../src';

describe('ApplicationClientImpl', () => {
  const mockApp = {
    query: vi.fn(),
  };

  const mockSigner = {
    address: vi.fn().mockResolvedValue('0x123'),
    sign: vi.fn(),
    containsKey: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Construction', () => {
    it('should create instance with required properties', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null,
        undefined,
        undefined,
        'http://localhost:8080'
      );

      expect(client.appId).toBe('test-app');
      expect(client.chainId).toBe('test-chain');
    });

    it('should store wallet info when provided', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        'wallet-chain-id',
        '0xwallet',
        'http://localhost:8080'
      );

      expect(client.getWalletAddress()).toBe('0xwallet');
      expect(client.getWalletChainId()).toBe('wallet-chain-id');
    });
  });

  describe('query', () => {
    it('should execute query and return result', async () => {
      mockApp.query.mockResolvedValue({ balance: 100 });

      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null,
        undefined,
        undefined,
        'http://localhost:8080'
      );

      const result = await client.query('{ balance }');

      expect(result).toEqual({ balance: 100 });
      expect(mockApp.query).toHaveBeenCalledWith('{ balance }', { blockHash: undefined });
    });

    it('should pass blockHash if provided', async () => {
      mockApp.query.mockResolvedValue({});

      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null,
        undefined,
        undefined,
        'http://localhost:8080'
      );

      await client.query('{ data }', 'block-hash-123');

      expect(mockApp.query).toHaveBeenCalledWith('{ data }', { blockHash: 'block-hash-123' });
    });

    it('should throw error with descriptive message on failure', async () => {
      mockApp.query.mockRejectedValue(new Error('Network error'));

      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null,
        undefined,
        undefined,
        'http://localhost:8080'
      );

      await expect(client.query('{ data }')).rejects.toThrow(
        'Application query failed: Network error'
      );
    });
  });

  describe('mutate', () => {
    it('should throw if wallet not connected', async () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null, // No signer
        undefined,
        undefined,
        'http://localhost:8080'
      );

      await expect(client.mutate('mutation { transfer }')).rejects.toThrow(
        'Wallet not connected. Please connect wallet to perform mutations.'
      );
    });

    it('should execute mutation when wallet connected', async () => {
      mockApp.query.mockResolvedValue({ success: true });

      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        'wallet-chain',
        '0xwallet',
        'http://localhost:8080'
      );

      const result = await client.mutate('mutation { transfer }');

      expect(result).toEqual({ success: true });
      expect(mockApp.query).toHaveBeenCalledWith('mutation { transfer }', { blockHash: undefined });
    });

    it('should pass blockHash to mutation', async () => {
      mockApp.query.mockResolvedValue({});

      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        'wallet-chain',
        '0xwallet',
        'http://localhost:8080'
      );

      await client.mutate('mutation { data }', 'block-123');

      expect(mockApp.query).toHaveBeenCalledWith('mutation { data }', { blockHash: 'block-123' });
    });
  });

  describe('canMutate', () => {
    it('should return false without wallet', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        null,
        undefined,
        undefined,
        'http://localhost:8080'
      );

      expect(client.canMutate()).toBe(false);
    });

    it('should return false without wallet chain ID', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        undefined, // No wallet chain ID
        '0xwallet',
        'http://localhost:8080'
      );

      expect(client.canMutate()).toBe(false);
    });

    it('should return false without wallet address', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        'wallet-chain',
        undefined, // No wallet address
        'http://localhost:8080'
      );

      expect(client.canMutate()).toBe(false);
    });

    it('should return true when all wallet info present', () => {
      const client = new ApplicationClientImpl(
        'test-app',
        'test-chain',
        mockApp as any,
        mockSigner as any,
        'wallet-chain',
        '0xwallet',
        'http://localhost:8080'
      );

      expect(client.canMutate()).toBe(true);
    });
  });

});
