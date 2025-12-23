import { createLineraClient, resetLineraClientManager } from '../../src';

/**
 * Real Example: Actual integration with a Linera node
 * Requires: FAUCET_URL, CHAIN_ID, APP_ID environment variables
 * Note: May fail if WASM doesn't load in Node.js (browser-only)
 */
export async function realExample() {
  // Validate environment
  const faucetUrl = process.env.FAUCET_URL;
  const chainId = process.env.CHAIN_ID;
  const appId = process.env.APP_ID;

  if (!faucetUrl || !chainId || !appId) {
    throw new Error('Missing required environment variables: FAUCET_URL, CHAIN_ID, APP_ID');
  }

  console.log('Configuration:');
  console.log(`  Faucet URL: ${faucetUrl}`);
  console.log(`  Chain ID: ${chainId}`);
  console.log(`  App ID: ${appId}`);
  console.log();

  // Reset any existing client
  resetLineraClientManager();

  console.log('Step 1: Create Client');
  console.log('─'.repeat(50));

  const client = createLineraClient({
    faucetUrl,
    defaultChainId: chainId,
    skipProcessInbox: true,
  });

  console.log('✓ Client created');
  console.log();

  // Initialize (this will attempt to load real WASM)
  console.log('Step 2: Initialize Client (Loading real WASM...)');
  console.log('─'.repeat(50));
  console.log('⚠️  This may fail if WASM is browser-only');
  console.log();

  try {
    await client.initialize();
    console.log('✓ Client initialized successfully!');
    console.log(`  Mode: ${client.getState().mode}`);
  } catch (error) {
    console.error('✗ Initialization failed:', (error as Error).message);
    console.error('   This is expected if @linera/client WASM requires browser APIs');
    console.error('   Try using the React hooks in a browser environment instead');
    throw error;
  }
  console.log();

  // Get application
  console.log('Step 3: Get Application Client');
  console.log('─'.repeat(50));

  const app = await client.getApplication(appId, chainId);

  if (!app) {
    throw new Error('Failed to get application client');
  }

  console.log('✓ Application client created');
  console.log(`  App ID: ${app.appId}`);
  console.log(`  Chain ID: ${app.chainId}`);
  console.log();

  // Execute real query
  console.log('Step 4: Execute Real Query');
  console.log('─'.repeat(50));

  try {
    // Customize this query based on your application's schema
    const queryResult = await app.query(
      'query { __typename }' // Generic query to test connection
    );
    
    console.log('✓ Query executed successfully');
    console.log('  Result:', JSON.stringify(queryResult, null, 2));
  } catch (error) {
    console.error('✗ Query failed:', (error as Error).message);
    console.error('   Check that your application is deployed and responding');
  }
  console.log();

  // Wallet connection note
  console.log('Step 5: Wallet Connection');
  console.log('─'.repeat(50));
  console.log('⚠️  Wallet connection (mutations) requires browser environment');
  console.log('   Use the React hooks in your frontend application to:');
  console.log('   - Connect MetaMask wallet');
  console.log('   - Execute mutations');
  console.log('   - Sign transactions');
  console.log();

  // Cleanup
  console.log('Step 6: Cleanup');
  console.log('─'.repeat(50));

  await client.destroy();
  console.log('✓ Client destroyed');
  console.log();

  console.log('✅ Real example completed successfully!');
}
