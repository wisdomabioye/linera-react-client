# Linera React Client

React hooks and providers for building Linera blockchain apps. Simple, TypeScript-native, works everywhere.

## Install

```bash
npm install linera-react-client
```

### Setup Linera Assets

After install, copy WASM files to your `public` folder:

```bash
npm run linera:copy
```

Or it happens automatically on postinstall (unless you use `--ignore-scripts`).

## Quick Start

### 1. Configure Your Build Tool

<details>
<summary><b>Next.js</b></summary>

```ts
// next.config.ts
import { withLinera } from 'linera-react-client/config/nextjs';

export default withLinera({
  // your Next.js config
});
```
</details>

<details>
<summary><b>Vite</b></summary>

```ts
// vite.config.ts
import { lineraPlugin } from 'linera-react-client/config/vite';

export default defineConfig({
  plugins: [react(), lineraPlugin()],
});
```
</details>

<details>
<summary><b>Create React App</b></summary>

```bash
npm install @craco/craco --save-dev
```

```js
// craco.config.js
const { createLineraConfig } = require('linera-react-client/config/craco');
module.exports = createLineraConfig();
```

Update package.json:
```json
{
  "scripts": {
    "start": "craco start",
    "build": "craco build"
  }
}
```
</details>

### 2. Wrap Your App

```tsx
import { LineraProvider } from 'linera-react-client';

function App() {
  return (
    <LineraProvider
      faucetUrl="http://localhost:8080"
      defaultChainId="your-app-chain-id"
    >
      <YourApp />
    </LineraProvider>
  );
}
```

### 3. Use the Hooks

```tsx
'use client';

import { useLineraApplication, useWalletConnection } from 'linera-react-client';

function MyComponent() {
  const { app, isReady } = useLineraApplication(APP_ID);
  const { connect, isConnected, address } = useWalletConnection();

  // Query (free, no wallet needed)
  const data = await app?.query('{ balance }');

  // Mutate (requires wallet)
  if (app?.canMutate()) {
    await app.mutate('mutation { transfer(to: "...", amount: 100) }');
  }

  return (
    <div>
      {isConnected ? (
        <p>Connected: {address}</p>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

## Core Concepts

### Application Client

```tsx
const { app } = useLineraApplication(appId, chainId?);

// Query (always available)
await app.query<T>(gql);
// Mutate (requires wallet)
await app.mutate<T>(gql);

// Check wallet status
app.canMutate();               // boolean
app.getWalletAddress();        // string | undefined
app.getWalletChainId();        // string | undefined
```

### Wallet Connection

```tsx
const {
  connect,              // () => Promise<void>
  disconnect,           // () => Promise<void>
  isConnected,          // boolean
  isConnecting,         // boolean
  address,              // string | undefined
  chainId,              // string | undefined
  isMetaMaskInstalled,  // boolean
} = useWalletConnection();
```

### Client State

```tsx
const {
  client,           // Low-level Linera client
  wallet,           // Wallet instance
  isInitialized,    // boolean
  isConnected,      // boolean
  canWrite,         // boolean
  walletAddress,    // string | undefined
  walletChainId,    // string | undefined
  defaultChainId,   // string | undefined
  error,            // Error | undefined
  getApplication,   // (appId, chainId?) => Promise<App>
} = useLineraClient();
```

## API Reference

### LineraProvider

```tsx
<LineraProvider
  faucetUrl="http://localhost:8080"     // Required
  defaultChainId="chain-id"             // Optional: default chain for queries
  network="testnet"                     // Optional: mainnet | testnet | local
  skipProcessInbox={false}              // Optional
  logging={true}                        // Optional: enable logging
  fallback={<Loading />}                // Optional: loading UI
  errorFallback={(error) => <Error />}  // Optional: error UI
  immediate={false}                     // Optional: render before init
>
  {children}
</LineraProvider>
```

### Configuration Helpers

All config helpers automatically set up required headers (COOP/COEP) for SharedArrayBuffer support.

| Framework | Import | Usage |
|-----------|--------|-------|
| Next.js | `config/nextjs` | `withLinera(nextConfig)` |
| Vite | `config/vite` | `lineraPlugin()` or `withLinera(viteConfig)` |
| CRA | `config/craco` | `createLineraConfig()` |
| Webpack | `config/webpack` | `withLinera(webpackConfig)` |

## TypeScript

Full type safety out of the box:

```tsx
interface MyData {
  balance: number;
}

const data = await app.query<MyData>('query: { query { balance } }');
// data.balance is typed as number
```


## Logging

```tsx
import { logger, LogLevel } from 'linera-react-client';

// In components
logger.info('User action', { userId: 123 });
logger.error('Failed', error);

// Configure in provider
<LineraProvider
  logging={{
    enabled: true,
    level: LogLevel.INFO,
    prefix: '[MyApp]',
    customLogger: {
      error: (msg, ...args) => Sentry.captureException(new Error(msg)),
    },
  }}
/>
```

## Node.js Support

Works in both browser and Node.js:

```ts
// Automatically uses correct module loader
// - Browser: dynamic import from /linera/linera.js
// - Node.js: require('@linera/client')
```

## Examples

Check the `/examples` folder for complete working apps:
- **Next.js App Router** - Full-stack app with App Router
- **Next.js Pages Router** - Pages Router implementation
- **Vite + React** - Fast dev server with Vite
- **Create React App** - CRA setup
- **Node.js** - Server-side usage with mock & real examples

### Running Examples

```bash
# Browser examples (Next.js, Vite, CRA)
cd examples/nextjs-app  # or nextjs-pages, vite, cra
npm install
npm run dev

# Node.js examples
cd examples/nodejs
npm install
npm start  # Runs both mock and real (if configured)
```

## Troubleshooting

**Windows Installation Error?**
```bash
npm install linera-react-client --ignore-scripts
npm run linera:copy
```

**Assets not loading?**
- Ensure `public/linera/` exists with WASM files
- Run `npm run linera:copy` manually
- Check your build tool config is set up

**TypeScript errors?**
- Ensure `moduleResolution: "bundler"` in tsconfig
- Restart TypeScript server

## Requirements

- React ≥ 18.0.0
- TypeScript ≥ 4.7 (optional but recommended)
- MetaMask browser extension (for wallet features)

## License

MIT

## Links

- [GitHub](https://github.com/wisdomabioye/linera-react-client)
- [NPM](https://www.npmjs.com/package/linera-react-client)
- [Issues](https://github.com/wisdomabioye/linera-react-client/issues)
