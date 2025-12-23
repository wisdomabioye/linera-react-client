/**
 * Linera React Client - Node.js Examples
 * 
 * This file demonstrates how to use the Linera client manager and application client
 * in a Node.js environment.
 * 
 * Run: npx ts-node examples/nodejs/index.ts
 */

import { mockExample } from './mock-example';
import { realExample } from './real-example';

const DIVIDER = '='.repeat(80);

async function main() {
  console.log(DIVIDER);
  console.log('🚀 Linera React Client - Node.js Examples');
  console.log(DIVIDER);
  console.log();

  // Check environment variables
  const hasRealConfig = process.env.FAUCET_URL && process.env.APP_ID && process.env.CHAIN_ID;

  if (hasRealConfig) {
    console.log('✅ Environment variables detected');
    console.log(`   FAUCET_URL: ${process.env.FAUCET_URL}`);
    console.log(`   CHAIN_ID: ${process.env.CHAIN_ID}`);
    console.log(`   APP_ID: ${process.env.APP_ID}`);
    console.log();
    console.log('Running BOTH examples (Mock first, then Real)...');
    console.log();
  } else {
    console.log('ℹ️  No environment variables detected');
    console.log('   Running MOCK example only');
    console.log();
    console.log('   To run the real example, set:');
    console.log('   - FAUCET_URL (e.g., http://localhost:8080)');
    console.log('   - CHAIN_ID (your application chain ID)');
    console.log('   - APP_ID (your application ID)');
    console.log();
  }

  // Run mock example
  console.log(DIVIDER);
  console.log('📦 Example 1: Mock Client (Always works)');
  console.log(DIVIDER);
  console.log();

  try {
    await mockExample();
  } catch (error) {
    console.error('❌ Mock example failed:', error);
    process.exit(1);
  }

  console.log();

  // Run real example if config available
  if (hasRealConfig) {
    console.log(DIVIDER);
    console.log('🌐 Example 2: Real Integration (Requires Linera node)');
    console.log(DIVIDER);
    console.log();

    try {
      await realExample();
    } catch (error) {
      console.error('❌ Real example failed:', error);
      console.error('   This is expected if WASM doesn\'t load in Node.js');
      console.error('   Try running in a browser environment instead');
    }
  }

  console.log();
  console.log(DIVIDER);
  console.log('✅ Examples completed!');
  console.log(DIVIDER);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
