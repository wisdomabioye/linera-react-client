import { createLineraClient, resetLineraClientManager } from '../../dist/index.mjs';

/**
 * Real Example: Actual integration with a Linera node in Node.js
 * Requires: FAUCET_URL, APP_ID environment variables
 *
 * Note: This example demonstrates READ-ONLY operations in Node.js
 * For wallet operations and mutations, use the browser/React environment
 */
export async function realExample() {
  // Validate environment
  const faucetUrl = process.env.FAUCET_URL;
  const appId = process.env.APP_ID;

  if (!faucetUrl || !appId) {
    throw new Error('Missing required environment variables: FAUCET_URL, APP_ID');
  }

  console.log('Configuration:');
  console.log(`  Faucet URL: ${faucetUrl}`);
  console.log(`  App ID: ${appId}`);
  console.log();

  // Reset any existing client
  resetLineraClientManager();

  console.log('Step 1: Create Client');
  console.log('─'.repeat(50));

  const client = createLineraClient({
    faucetUrl,
    skipProcessInbox: true,
  });

  console.log('✓ Client created');
  console.log();

  // Initialize in read-only mode (works in Node.js)
  console.log('Step 2: Initialize Read-Only Client');
  console.log('─'.repeat(50));
  console.log('ℹ️  Loading @linera/client WASM module...');
  console.log();

  try {
    await client.initializeReadOnly();
    const state = client.getState();
    console.log('✓ Client initialized successfully!');
    console.log(`  Mode: ${state.mode}`);
    console.log(`  Public Chain ID: ${state.publicChainId}`);
    console.log(`  Public Address: ${state.publicAddress}`);
  } catch (error) {
    console.error('✗ Initialization failed:', (error as Error).message);
    console.error('   Make sure @linera/client is installed and supports Node.js');
    throw error;
  }
  console.log();

  // Get application client
  console.log('Step 3: Get Application Client');
  console.log('─'.repeat(50));

  const app = await client.getApplication(appId);

  if (!app) {
    throw new Error('Failed to get application client');
  }

  console.log('✓ Application client created');
  console.log(`  App ID: ${app.appId}`);
  console.log();

  // Execute query using public app (read-only)
  console.log('Step 4: Execute Query (Read-Only)');
  console.log('─'.repeat(50));

  try {
    // Customize this query based on your application's schema
    const queryResult = await app.public.query(
      'query { __typename }' // Generic query to test connection
    );

    console.log('✓ Query executed successfully');
    console.log('  Result:', JSON.stringify(queryResult, null, 2));
    console.log(`  Chain ID: ${app.public.getChainId()}`);
    console.log(`  Address: ${app.public.getAddress()}`);
  } catch (error) {
    console.error('✗ Query failed:', (error as Error).message);
    console.error('   Check that your application is deployed and responding');
  }
  console.log();

  // Node.js limitations
  console.log('Step 5: Node.js Limitations');
  console.log('─'.repeat(50));
  console.log('✓ Available in Node.js:');
  console.log('  - Read-only initialization');
  console.log('  - GraphQL queries (app.public.query)');
  console.log('  - Chain data access');
  console.log('  - System mutations (app.public.systemMutate)');
  console.log();
  console.log('✗ NOT available in Node.js:');
  console.log('  - Wallet connection (requires browser/MetaMask)');
  console.log('  - User mutations (requires wallet signatures)');
  console.log('  - app.wallet.* methods');
  console.log();
  console.log('💡 For wallet features, use the React hooks in a browser environment');
  console.log();

  // Cleanup
  console.log('Step 6: Cleanup');
  console.log('─'.repeat(50));

  await client.destroy();
  console.log('✓ Client destroyed');
  console.log();

  console.log('✅ Real example completed successfully!');
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  realExample().catch(console.error);
}
