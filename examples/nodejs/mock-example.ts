import { createLineraClient, resetLineraClientManager } from '../../dist/index.mjs';

/**
 * Mock Example: Demonstrates API usage in Node.js
 * Shows the client lifecycle and read-only operations
 */
export async function mockExample() {
  console.log('Step 1: Create Client');
  console.log('─'.repeat(50));

  // Reset any existing client (useful for testing)
  resetLineraClientManager();

  // Create client with configuration
  const client = createLineraClient({
    faucetUrl: 'https://faucet.testnet-conway.linera.net',
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

  // Initialize in read-only mode
  console.log('Step 3: Initialize Read-Only Mode');
  console.log('─'.repeat(50));

  try {
    await client.initializeReadOnly();

    const state = client.getState();
    console.log('✓ Client initialized');
    console.log(`  Mode: ${state.mode}`);
    console.log(`  Public Chain ID: ${state.publicChainId}`);
    console.log(`  Public Address: ${state.publicAddress}`);
    console.log(`  Can write (wallet): ${client.canWrite()}`);
  } catch (error) {
    console.error('✗ Initialization failed:', (error as Error).message);
    console.error('Full error:', error);
    throw error;
  }
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
  console.log(`  Has public app: ${!!app.public}`);
  console.log(`  Has wallet app: ${!!app.wallet}`);
  console.log();

  // Execute query (read-only, no wallet needed)
  console.log('Step 5: Execute Query (Read-Only)');
  console.log('─'.repeat(50));

  try {
    // Using public app for queries
    const queryResult = await app.public.query<{ balance: number }>(
      'query { balance }'
    );
    console.log('✓ Query executed successfully');
    console.log('  Result:', JSON.stringify(queryResult, null, 2));
    console.log(`  Chain ID: ${app.public.getChainId()}`);
    console.log(`  Address: ${app.public.getAddress()}`);
  } catch (error) {
    console.log('✗ Query failed:', (error as Error).message);
    console.log('   (This is expected if the app is not actually deployed)');
  }
  console.log();

  // Try wallet mutation without wallet (should fail)
  console.log('Step 6: Try Wallet Mutation Without Connection');
  console.log('─'.repeat(50));

  if (!app.wallet) {
    console.log('✓ app.wallet is undefined (expected - no wallet connected)');
  } else {
    console.log('✗ Unexpected: app.wallet exists without connection');
  }
  console.log();

  // Explain wallet connection limitation
  console.log('Step 7: Wallet Connection (Browser-Only)');
  console.log('─'.repeat(50));

  console.log('⚠️  Wallet connection requires browser environment');
  console.log('   Reasons:');
  console.log('   - Requires MetaMask or other browser wallet extension');
  console.log('   - connectWallet() checks for window object');
  console.log('   - Transaction signing needs user interaction');
  console.log();
  console.log('💡 In browser/React, you would:');
  console.log('   1. const signer = new MetamaskSigner();');
  console.log('   2. await client.connectWallet(signer);');
  console.log('   3. await app.wallet.mutate("mutation { ... }");');
  console.log();

  // Check client state
  console.log('Step 8: Check Client State');
  console.log('─'.repeat(50));

  const finalState = client.getState();
  console.log('Current state:');
  console.log(`  Mode: ${finalState.mode}`);
  console.log(`  Initialized: ${finalState.isInitialized}`);
  console.log(`  Has wallet: ${finalState.hasWallet}`);
  console.log(`  Can write: ${client.canWrite()}`);
  console.log(`  Faucet URL: ${finalState.faucetUrl}`);
  console.log();

  // Cleanup
  console.log('Step 9: Cleanup Resources');
  console.log('─'.repeat(50));

  unsubscribe();
  await client.destroy();

  console.log('✓ Client destroyed');
  console.log(`  Mode: ${client.getState().mode}`);
  console.log(`  Initialized: ${client.getState().isInitialized}`);
  console.log();

  console.log('✅ Mock example completed successfully!');
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  mockExample().catch(console.error);
}
