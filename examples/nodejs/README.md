# Node.js Examples

Demonstrates using `linera-react-client` in Node.js environment.

## Setup

```bash
# Navigate to examples directory
cd examples/nodejs

# Install dependencies
npm install

# Run examples
npm start
```

## Quick Start

### Run Mock Example (Always Works)

```bash
npm start
# or
npm run mock
```

No setup required - demonstrates API usage with simulated client.

### Run Real Example (Requires Linera Node)

```bash
# Set environment variables
export FAUCET_URL=http://localhost:8080
export CHAIN_ID=your-chain-id-here
export APP_ID=your-app-id-here

# Run
npm start
```

Or use a `.env` file:

```bash
# Create .env file
cat > .env << EOF
FAUCET_URL=http://localhost:8080
CHAIN_ID=your-chain-id
APP_ID=your-app-id
EOF

# Load and run
source .env && npm start
```

## Available Scripts

- `npm start` - Run both examples (mock + real if configured)
- `npm run mock` - Run mock example only
- `npm run real` - Run real example only (requires env vars)

## Examples

### 1. Mock Example (`mock-example.ts`)

Demonstrates API usage with simulated Linera client. Perfect for:
- Understanding the API
- Testing your code
- Quick prototyping

**No setup required** - just run!

### 2. Real Example (`real-example.ts`)

Actual integration with running Linera infrastructure.

**Prerequisites:**
- Running Linera node
- Valid faucet URL
- Deployed application

**Note:** May fail if `@linera/client` WASM is browser-only. In that case, use the React hooks in a browser environment instead.

## What's Demonstrated

- ✅ Client initialization and lifecycle
- ✅ State management and listeners
- ✅ Querying applications (READ_ONLY mode)
- ✅ Attempting mutations (shows wallet requirement)
- ✅ Error handling patterns
- ✅ Resource cleanup

## Expected Output

```
================================================================================
🚀 Linera React Client - Node.js Examples
================================================================================

ℹ️  No environment variables detected
   Running MOCK example only
   ...

Step 1: Create and Initialize Client
──────────────────────────────────────────────────
✓ Client created
  Mode: UNINITIALIZED
  Initialized: false
  ...

✅ Examples completed!
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FAUCET_URL` | For real example | Linera faucet/node URL | `http://localhost:8080` |
| `CHAIN_ID` | For real example | Application chain ID | `e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65` |
| `APP_ID` | For real example | Application ID | `e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000` |

## Troubleshooting

**"Cannot find module 'linera-react-client'"**
```bash
# From this directory
npm install
```

**"Failed to initialize client"**
- WASM may not load in Node.js (browser-only)
- Solution: Use React hooks in browser environment

**"Wallet connection only available on client side"**
- Expected in Node.js
- Wallet features require browser + MetaMask

**"Failed to get application client"**
- Check FAUCET_URL is reachable
- Verify CHAIN_ID and APP_ID are correct
- Ensure Linera node is running

**TypeScript errors**
```bash
# Ensure types are installed
npm install
```

## For Production Use

For production applications:
1. Use the React hooks (`useLineraClient`, `useLineraApplication`)
2. Run in browser environment
3. Connect real MetaMask wallet
4. See main [README](../../README.md) for browser setup

## Project Structure

```
examples/nodejs/
├── index.ts           # Main entry point (runs both examples)
├── mock-example.ts    # Mock demonstration
├── real-example.ts    # Real integration example
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript config
└── README.md          # This file
```

## Need Help?

- [Main Documentation](../../README.md)
- [GitHub Issues](https://github.com/wisdomabioye/linera-react-client/issues)
- [API Reference](../../docs/api.md)
