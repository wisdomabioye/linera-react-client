import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { 
  LineraProvider, 
  useLineraClient,
  useLineraApplication,
  ClientMode,
  resetLineraClientManager
} from '../../src';
import type { ReactNode } from 'react';

// Mock modules
// vi.mock('@linera/client/dist');
vi.mock('@/lib/linera/temporary-signer');

const wrapper = ({ children }: { children: ReactNode }) => (
  <LineraProvider faucetUrl="http://localhost:8080" defaultChainId="test-chain">
    {children}
  </LineraProvider>
);

describe('React Hooks Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLineraClientManager();
  });

  describe('useLineraClient', () => {
    it('should provide client state', async () => {
      const { result } = renderHook(() => useLineraClient(), { wrapper });

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.state.mode).toBe(ClientMode.READ_ONLY);
      expect(result.current.defaultChainId).toBe('test-chain');
    });

    it('should expose getApplication function', async () => {
      const { result } = renderHook(() => useLineraClient(), { wrapper });

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(typeof result.current.getApplication).toBe('function');
    });

    it('should indicate not connected initially', async () => {
      const { result } = renderHook(() => useLineraClient(), { wrapper });

      await waitFor(() => {
        expect(result.current.isInitialized).toBe(true);
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.canWrite).toBe(false);
    });
  });

  describe('useLineraApplication', () => {
    it('should load application after initialization', async () => {
      const { result } = renderHook(() => useLineraApplication('test-app'), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.app).not.toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should use provided chainId', async () => {
      const { result } = renderHook(
        () => useLineraApplication('test-app', 'custom-chain'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.app?.chainId).toBe('custom-chain');
    });

    it('should use default chainId when not specified', async () => {
      const { result } = renderHook(() => useLineraApplication('test-app'), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.app?.chainId).toBe('test-chain');
    });

    it('should indicate cannot write initially', async () => {
      const { result } = renderHook(() => useLineraApplication('test-app'), { wrapper });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.canWrite).toBe(false);
    });
  });

  describe('LineraProvider', () => {
    it('should render children after initialization', async () => {
      render(
        <LineraProvider faucetUrl="http://localhost:8080" defaultChainId="test-chain">
          <div>Test Content</div>
        </LineraProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeInTheDocument();
      });
    });

    it('should show fallback during initialization', () => {
      render(
        <LineraProvider
          faucetUrl="http://localhost:8080"
          fallback={<div>Loading...</div>}
          immediate={false}
        >
          <div>Test Content</div>
        </LineraProvider>
      );

      // Should show fallback initially
      expect(screen.queryByText('Loading...')).toBeInTheDocument();
    });

    it('should render immediately in immediate mode', () => {
      render(
        <LineraProvider faucetUrl="http://localhost:8080" immediate={true}>
          <div>Immediate Content</div>
        </LineraProvider>
      );

      // Should render children immediately without waiting
      expect(screen.getByText('Immediate Content')).toBeInTheDocument();
    });
  });
});
