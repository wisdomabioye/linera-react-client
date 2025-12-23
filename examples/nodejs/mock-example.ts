import { createLineraClient, resetLineraClientManager } from '../../src';

/**
 * Mock Example: Demonstrates API usage with simulated Linera client
 * This works in any environment without needing a real Linera node
 */
export async function mockExample() {
  console.log('Step 1: Create and Initialize Client');
  console.log('─'.repeat(50));

  // Reset any existing client (useful for testing)
  resetLineraClientManager();

  // Create client with mock configuration
  const client = createLineraClient({
    faucetUrl: 'http://localhost:8080', // Mock faucet URL
    defaultChainId: 'default-chain-123',
    skipProcessInbox: true,
  });

  console.log('✓ Client created');
  console.log(`  Mode: ${client.getState().mode}`);
  console.log(`  Initialized: ${client.getState().isInitialized}`);
  console.log();

  // Subscribe to state changes
  console.log('Step 2: Subscribe to State Changes');
  console.log('─'.repeat(50));

  const unsubscribe = client.onStateChange((state) => {
    console.log(`  📡 State changed: ${state.mode}`);
    if (state.error) {
      console.log(`     Error: ${state.error.message}`);
    }
  });

  console.log('✓ Listener registered');
  console.log();

  // Initialize client
  console.log('Step 3: Initialize Client (Load WASM, Create Wallet)');
  console.log('─'.repeat(50));

  await client.initialize();

  const state = client.getState();
  console.log('✓ Client initialized');
  console.log(`  Mode: ${state.mode}`);
  console.log(`  Can write: ${client.canWrite()}`);
  console.log(`  Default chain: ${state.defaultChainId}`);
  console.log();

  // Get application client
  console.log('Step 4: Get Application Client');
  console.log('─'.repeat(50));

  const app = await client.getApplication('my-app-123');

  if (!app) {
    throw new Error('Failed to get application client');
  }

  console.log('✓ Application client created');
  console.log(`  App ID: ${app.appId}`);
  console.log(`  Chain ID: ${app.chainId}`);
  console.log(`  Can mutate: ${app.canMutate()}`);
  console.log();

  // Execute query (no wallet needed)
  console.log('Step 5: Execute Query (READ_ONLY mode)');
  console.log('─'.repeat(50));

  try {
    const queryResult = await app.query<{ balance: number }>(
      'query { balance }'
    );
    console.log('✓ Query executed successfully');
    console.log(`  Result:`, JSON.stringify(queryResult, null, 2));
  } catch (error) {
    console.log('✗ Query failed:', error);
  }
  console.log();

  // Try mutation without wallet (should fail)
  console.log('Step 6: Try Mutation Without Wallet (Should Fail)');
  console.log('─'.repeat(50));

  try {
    await app.mutate('mutation { transfer(to: "0x123", amount: 100) }');
    console.log('✗ Unexpected: mutation succeeded without wallet!');
  } catch (error) {
    console.log('✓ Expected error:', (error as Error).message);
  }
  console.log();

  // Simulate wallet connection (browser-only in production)
  console.log('Step 7: Simulate Wallet Connection (Browser-only feature)');
  console.log('─'.repeat(50));

  console.log('⚠️  Wallet connection requires browser environment (MetaMask)');
  console.log('   In Node.js, we can only simulate the state transition');
  console.log();

  // Create mock signer for demonstration
  const mockSigner = {
    address: async () => '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    signMessage: async (msg: Uint8Array) => msg,
  };

  // This will fail in Node.js (no window object)
  try {
    // Temporarily mock window for demonstration
    (global as any).window = { location: { origin: 'http://localhost' } };
    
    await client.connectWallet(mockSigner as any);
    
    console.log('✓ Wallet connected (simulated)');
    console.log(`  Mode: ${client.getState().mode}`);
    console.log(`  Address: ${client.getState().walletAddress}`);
    console.log(`  Can write: ${client.canWrite()}`);
    
    // Clean up mock
    delete (global as any).window;
  } catch (error) {
    console.log('⚠️  Cannot connect wallet in Node.js:', (error as Error).message);
  }
  console.log();

  // Cleanup
  console.log('Step 8: Cleanup Resources');
  console.log('─'.repeat(50));

  unsubscribe();
  await client.destroy();

  console.log('✓ Client destroyed');
  console.log(`  Mode: ${client.getState().mode}`);
  console.log(`  Initialized: ${client.getState().isInitialized}`);
  console.log();

  console.log('✅ Mock example completed successfully!');
}
