import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientMode, LineraClientManager, createLineraClient, resetLineraClientManager } from '../../src';

// Mock modules
vi.mock('@/lib/linera/temporary-signer');

describe('LineraClientManager', () => {
  beforeEach(() => {
    resetLineraClientManager();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create a client instance', () => {
      const client = createLineraClient({
        faucetUrl: 'http://localhost:8080',
        defaultChainId: 'test-chain',
      });

      expect(client).toBeInstanceOf(LineraClientManager);
    });

    it('should return same instance (singleton)', () => {
      const client1 = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      const client2 = createLineraClient({ faucetUrl: 'http://localhost:8080' });

      expect(client1).toBe(client2);
    });

    it('should start in UNINITIALIZED mode', () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      const state = client.getState();

      expect(state.mode).toBe(ClientMode.UNINITIALIZED);
      expect(state.isInitialized).toBe(false);
    });

    it('should transition to READ_ONLY mode after initialization', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });

      await client.initialize();
      const state = client.getState();

      expect(state.mode).toBe(ClientMode.READ_ONLY);
      expect(state.isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });

      await client.initialize();
      await client.initialize(); // Second call should be no-op

      expect(client.getState().mode).toBe(ClientMode.READ_ONLY);
    });
  });

  describe('State Management', () => {
    it('should include defaultChainId in state', () => {
      const client = createLineraClient({
        faucetUrl: 'http://localhost:8080',
        defaultChainId: 'my-chain-id',
      });

      const state = client.getState();
      expect(state.defaultChainId).toBe('my-chain-id');
      expect(state.faucetUrl).toBe('http://localhost:8080');
    });

    it('should notify listeners on state change', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      const listener = vi.fn();

      client.onStateChange(listener);
      await client.initialize();

      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].mode).toBe(ClientMode.READ_ONLY);
    });

    it('should allow unsubscribing from state changes', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      const listener = vi.fn();

      const unsubscribe = client.onStateChange(listener);
      unsubscribe();

      await client.initialize();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Wallet Connection', () => {
    it('should reject wallet connection in Node.js', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      const mockSigner = {
        address: vi.fn().mockResolvedValue('0x123'),
        sign: vi.fn(),
        containsKey: vi.fn(),
      };

      // Simulate Node.js environment
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      await expect(client.connectWallet(mockSigner as any)).rejects.toThrow(
        'Wallet connection only available on client side'
      );

      // Restore
      // @ts-ignore
      global.window = originalWindow;
    });

    it('should transition to FULL mode after wallet connection', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      const mockSigner = {
        address: vi.fn().mockResolvedValue('0x123'),
        sign: vi.fn(),
        containsKey: vi.fn(),
      };

      await client.connectWallet(mockSigner as any);
      const state = client.getState();

      expect(state.mode).toBe(ClientMode.FULL);
      expect(state.hasWallet).toBe(true);
      expect(state.walletAddress).toBe('0x123');
    });

    it('should auto-initialize if not initialized', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });

      const mockSigner = {
        address: vi.fn().mockResolvedValue('0x456'),
        sign: vi.fn(),
        containsKey: vi.fn(),
      };

      expect(client.getState().isInitialized).toBe(false);

      await client.connectWallet(mockSigner as any);

      expect(client.getState().isInitialized).toBe(true);
      expect(client.getState().mode).toBe(ClientMode.FULL);
    });

    it('should revert to READ_ONLY on disconnect', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      const mockSigner = {
        address: vi.fn().mockResolvedValue('0x789'),
        sign: vi.fn(),
        containsKey: vi.fn(),
      };

      await client.connectWallet(mockSigner as any);
      expect(client.getState().mode).toBe(ClientMode.FULL);

      await client.disconnectWallet();
      const state = client.getState();

      expect(state.mode).toBe(ClientMode.READ_ONLY);
      expect(state.hasWallet).toBe(false);
      expect(state.walletAddress).toBeUndefined();
      expect(state.walletChainId).toBeUndefined();
    });
  });

  describe('getApplication', () => {
    it('should throw if no chainId provided and no default', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      await expect(client.getApplication('test-app')).rejects.toThrow(
        'No chainId provided and no defaultChainId configured'
      );
    });

    it('should use defaultChainId if not provided', async () => {
      const client = createLineraClient({
        faucetUrl: 'http://localhost:8080',
        defaultChainId: 'default-chain',
      });
      await client.initialize();

      const app = await client.getApplication('test-app');

      expect(app).not.toBeNull();
      expect(app?.chainId).toBe('default-chain');
    });

    it('should override defaultChainId with provided chainId', async () => {
      const client = createLineraClient({
        faucetUrl: 'http://localhost:8080',
        defaultChainId: 'default-chain',
      });
      await client.initialize();

      const app = await client.getApplication('test-app', 'custom-chain');

      expect(app).not.toBeNull();
      expect(app?.chainId).toBe('custom-chain');
    });

    it('should return null if not initialized', async () => {
      const client = createLineraClient({
        faucetUrl: 'http://localhost:8080',
        defaultChainId: 'test-chain',
      });

      const app = await client.getApplication('test-app');
      expect(app).toBeNull();
    });
  });

  describe('canWrite', () => {
    it('should return false in READ_ONLY mode', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      expect(client.canWrite()).toBe(false);
    });

    it('should return true in FULL mode', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      const mockSigner = {
        address: vi.fn().mockResolvedValue('0xabc'),
        sign: vi.fn(),
        containsKey: vi.fn(),
      };

      await client.connectWallet(mockSigner as any);
      expect(client.canWrite()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should reset to UNINITIALIZED state', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      await client.initialize();

      await client.destroy();
      const state = client.getState();

      expect(state.mode).toBe(ClientMode.UNINITIALIZED);
      expect(state.isInitialized).toBe(false);
    });

    it('should clear all state listeners', async () => {
      const client = createLineraClient({ faucetUrl: 'http://localhost:8080' });
      const listener = vi.fn();

      client.onStateChange(listener);
      await client.destroy();

      // Try to trigger state change
      await client.initialize();

      // Listener should not be called since it was cleared
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
