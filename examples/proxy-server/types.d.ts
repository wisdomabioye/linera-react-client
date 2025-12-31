/**
 * Type declarations for the headless browser window object
 */

declare global {
  interface Window {
    LineraReactClient: any;
    LineraProxy: {
      initializeLinera: (config: any) => Promise<{ success: boolean; state?: any; error?: string }>;
      getApplication: (appId: string) => Promise<any>;
      executeQuery: (appId: string, query: string, options?: any) => Promise<any>;
      executeSystemMutation: (appId: string, mutation: string, options?: any) => Promise<any>;
      getClientState: () => any;
      getChain: (chainId: string) => Promise<any>;
      getChainApplication: (chainId: string, appId: string) => Promise<any>;
    };
  }
}

export {};
