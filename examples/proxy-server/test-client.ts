/**
 * Simple test client for the Linera Proxy Server
 *
 * Usage:
 *   tsx test-client.ts
 */

const BASE_URL = process.env.PROXY_URL || 'http://localhost:3001';
const APP_ID = process.env.APP_ID || 'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000';

async function testProxyServer() {
  console.log('🧪 Testing Linera Proxy Server');
  console.log('📡 Server:', BASE_URL);
  console.log('');

  try {
    // Test 1: Health check
    console.log('Test 1: Health Check');
    console.log('─'.repeat(50));
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const health = await healthResponse.json();
    console.log('✅ Health:', health);
    console.log('');

    if (!health.ready) {
      console.error('❌ Server not ready!');
      process.exit(1);
    }

    // Test 2: Get state
    console.log('Test 2: Get Client State');
    console.log('─'.repeat(50));
    const stateResponse = await fetch(`${BASE_URL}/api/state`);
    const stateData = await stateResponse.json();
    console.log('✅ State:', JSON.stringify(stateData.state, null, 2));
    console.log('');

    // Test 3: Execute query
    console.log('Test 3: Execute Query');
    console.log('─'.repeat(50));
    console.log('App ID:', APP_ID);
    console.log('Query: query { __typename }');

    const queryResponse = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: APP_ID,
        query: 'query { __typename }'
      })
    });

    const queryData = await queryResponse.json();

    if (queryData.success) {
      console.log('✅ Query result:', JSON.stringify(queryData.data, null, 2));
    } else {
      console.log('❌ Query failed:', queryData.error);
      console.log('   This is expected if the app is not deployed');
    }
    console.log('');

    // Test 4: Get chain info
    if (stateData.state.publicChainId) {
      console.log('Test 4: Get Chain Info');
      console.log('─'.repeat(50));
      const chainResponse = await fetch(
        `${BASE_URL}/api/chain/${stateData.state.publicChainId}`
      );
      const chainData = await chainResponse.json();

      if (chainData.success) {
        console.log('✅ Chain info:', JSON.stringify(chainData.data, null, 2));
      } else {
        console.log('❌ Failed to get chain:', chainData.error);
      }
      console.log('');
    }

    console.log('═'.repeat(50));
    console.log('✅ All tests completed!');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testProxyServer();
