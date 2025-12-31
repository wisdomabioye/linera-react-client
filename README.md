# Linera React Client

A React client library for Linera blockchain with hooks, providers, and wallet management.

## Installation

```bash
npm install linera-react-client
# or
yarn add linera-react-client
# or
pnpm add linera-react-client
```

### Windows Installation

**Known Issue**: On Windows, installation may fail due to a compatibility issue in the `@linera/client` dependency (not in this package).

**Error you might see:**
```
npm error 'true' is not recognized as an internal or external command
```

**Workaround**: Use the `--ignore-scripts` flag:

```bash
npm install linera-react-client --ignore-scripts
# or
yarn add linera-react-client --ignore-scripts
# or
pnpm add linera-react-client --ignore-scripts
```

> **Note**: Using `--ignore-scripts` skips the postinstall script. You'll need to manually copy Linera assets (see next section).

After installation, manually run:
```bash
npm run linera:copy
# or
yarn linera:copy
# or
pnpm linera:copy
```

### Linera Assets Setup

The library requires Linera WASM and worker files to be served as static assets from your `public` directory.

#### Automatic Setup (Recommended)

The postinstall script **automatically** copies required files after installation:

```bash
npm install linera-react-client  # Files copied automatically ✓
```

The script:
- ✅ Detects your framework (Next.js, Vite, CRA)
- ✅ Copies files to the correct `public` directory
- ✅ Skips in CI environments
- ✅ Can be configured via `package.json`

#### Manual Copy (If Needed)

If automatic copy fails or you're in CI:

```bash
npm run linera:copy
```

Or copy files manually:
```bash
# From: node_modules/@linera/client/dist
# To: public/linera/
```

#### Configuration Options

Skip postinstall or customize directories in your `package.json`:

```json
{
  "lineraConfig": {
    "skipPostinstall": true,        // Skip automatic copy
    "publicDir": "public",           // Custom public directory
    "targetDir": "linera"            // Custom target subdirectory
  }
}
```

#### Troubleshooting

**Files not copied?**
- Run manually: `npm run linera:copy`
- Check permissions on `public` directory
- Ensure `@linera/client` is installed

**CI/CD environments:**
- Postinstall skips in CI by default
- Run manually in build step: `npm run linera:copy`

## Quick Start

### 1. Configure Your Framework

#### Next.js

```typescript
// next.config.ts
import { withLinera } from 'linera-react-client/config/nextjs';

export default withLinera({
  // Your Next.js config
});
```

#### Vite

**Option 1: Plugin (Recommended)**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lineraPlugin } from 'linera-react-client/config/vite';

export default defineConfig({
  plugins: [
    react(),
    lineraPlugin(),
  ],
});
```

**Option 2: Complete Config Helper**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withLinera } from 'linera-react-client/config/vite';

export default defineConfig(
  withLinera({
    plugins: [react()],
    // Your other Vite config
  })
);
```

#### Create React App (with CRACO)

```javascript
// craco.config.js
const { createLineraConfig } = require('linera-react-client/config/craco');

module.exports = createLineraConfig();
```

Update your `package.json` scripts:
```json
{
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test"
  }
}
```

#### Generic Webpack

```javascript
// webpack.config.js
const { withLinera } = require('linera-react-client/config/webpack');

module.exports = withLinera({
  // Your webpack config
  entry: './src/index.js',
  // ...
});
```

### 2. Wrap your app with LineraProvider

**Recommended: Use Constant Address (Most Efficient)**

```typescript
// app/layout.tsx or _app.tsx
import { LineraProvider } from 'linera-react-client';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LineraProvider
          faucetUrl="http://localhost:8080"
          readOnlyWallet={{
            constantAddress: "0x0000000000000000000000000000000000000000"
          }}
        >
          {children}
        </LineraProvider>
      </body>
    </html>
  );
}
```

**Alternative Options:**

```typescript
// Option 1: Constant Address (Recommended - Most Efficient)
// - Zero overhead (no wallet creation)
// - Same chain for all users
// - Predictable and efficient
<LineraProvider
  faucetUrl="http://localhost:8080"
  readOnlyWallet={{
    constantAddress: "0x0000000000000000000000000000000000000000"
  }}
>
  {children}
</LineraProvider>

// Option 2: Persisted in localStorage
// - Wallet survives page reloads
// - User keeps same read-only wallet
<LineraProvider
  faucetUrl="http://localhost:8080"
  readOnlyWallet={{
    storage: 'localStorage'
  }}
>
  {children}
</LineraProvider>

// Option 3: Session Storage
// - Wallet survives during browser session
// - Cleared when browser is closed
<LineraProvider
  faucetUrl="http://localhost:8080"
  readOnlyWallet={{
    storage: 'sessionStorage'
  }}
>
  {children}
</LineraProvider>

// Option 4: Ephemeral (Default)
// - New wallet on every page reload
// - Maximum privacy, no persistence
<LineraProvider faucetUrl="http://localhost:8080">
  {children}
</LineraProvider>
```

### 3. Use the hooks in your components

```typescript
// components/WalletButton.tsx
'use client';

import { useWalletConnection, useLineraClient } from 'linera-react-client';

export function WalletButton() {
  const { isConnected, connect, disconnect, address } = useWalletConnection();
  const { chainId } = useLineraClient();

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
        <p>Chain: {chainId}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return <button onClick={connect}>Connect Wallet</button>;
}
```

### 4. Query and mutate applications

**Using Dual-Chain Architecture**

```typescript
'use client';

import { useApplication } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function AuctionList() {
  const { app, isReady } = useApplication(APP_ID);
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    if (!isReady || !app) return;

    const fetchAuctions = async () => {
      // Use public for queries - always available
      const result = await app.public.query<{ auctions: Auction[] }>(
        '{ "query": "query { auctions }" }'
      );
      setAuctions(result.auctions);
    };

    fetchAuctions();
  }, [isReady, app]);

  const handleBid = async (auctionId: string, amount: number) => {
    if (!app?.wallet) {
      alert('Please connect your wallet first');
      return;
    }

    // Use wallet for user mutations - requires wallet connection
    await app.wallet.mutate(`{
      "query": "mutation { placeBid(auctionId: \\"${auctionId}\\", amount: ${amount}) }"
    }`);
  };

  const handleSubscribe = async (channelId: string) => {
    if (!app) return;

    // Use public.systemMutate for subscriptions - no wallet needed!
    await app.public.systemMutate(`
      mutation { subscribe(channelId: "${channelId}") }
    `);
  };

  return (
    <div>
      {auctions.map(auction => (
        <AuctionCard
          key={auction.id}
          auction={auction}
          onBid={handleBid}
          onSubscribe={handleSubscribe}
        />
      ))}
    </div>
  );
}
```

## Recent Improvements ✨

**Latest Updates** - Performance and stability improvements for better developer experience.

### Bug Fixes & Optimizations

#### Fixed Stale Reference Checks (application-client.ts)
- **Issue**: Wallet app methods had circular reference checks (`this.wallet` checking itself)
- **Fix**: Removed redundant checks, now only validates `walletApp` availability
- **Impact**: Prevents false positives and provides clearer error messages when wallet is disconnected

#### Fixed Race Condition (useLineraClient.ts)
- **Issue**: State could be out of sync between initialization and subscription
- **Fix**: Immediately sync state on mount before subscribing to changes
- **Impact**: Ensures hook always has current client state, preventing stale data

#### Optimized Wallet Reconnection (client-manager.ts)
- **Issue**: Redundant state notifications when same wallet reconnects
- **Fix**: Only notify listeners when signer actually changes
- **Impact**: Reduces unnecessary re-renders when wallet reconnects with same address

#### Optimized Wallet Chain Access (client-manager.ts)
- **Issue**: Wallet chain was accessed repeatedly without caching, inconsistent with public chain
- **Fix**: Added dedicated wallet chain cache with automatic invalidation on wallet state changes
- **Impact**: Consistent caching strategy for both public and wallet chains, improved performance

### Performance Benefits

These fixes eliminate:
- ❌ Unnecessary component re-renders on wallet reconnection
- ❌ Stale state during initialization
- ❌ Confusing error messages from circular checks

Result: **Smoother wallet operations and better React performance** 🚀

## Dual-Chain Architecture 🆕

**Version 1.1.0** introduces a powerful dual-chain architecture that separates read operations from write operations for better UX and efficiency.

### The Problem

Previously, Linera required claiming a new chain every time a wallet was connected or switched. This meant:
- ❌ Chain IDs changed when wallets connected
- ❌ Subscriptions were lost on wallet disconnect
- ❌ Users needed to sign for cross-chain subscriptions

### The Solution: Two Chains

The new architecture maintains **two separate chains** with different purposes:

| Chain Type | Purpose | Signer | Persistence | Use Cases |
|------------|---------|--------|-------------|-----------|
| **Public Chain** | Read & Subscribe | Temporary (auto) | Persists across wallet connections | Queries, subscriptions, cross-chain messaging |
| **Wallet Chain** | User Mutations | MetaMask | Only when wallet connected | Transfers, user actions requiring signature |

### How It Works

```typescript
await client.initializeReadOnly();
// ✅ Public chain claimed: chain_abc123 (temporary signer)

const app = await client.getApplication(appId);

// Query on public chain (always available)
await app.public.query('{ balance }');

// Subscribe on public chain (auto-signed, no user prompt!)
await app.public.systemMutate('mutation { subscribe(...) }');

// Connect wallet
await client.connectWallet(metamaskSigner);
// ✅ Wallet chain claimed: chain_def456 (MetaMask signer)
// ✅ Public chain STILL ACTIVE: chain_abc123

// User mutations on wallet chain (requires signature)
await app.wallet.mutate('mutation { transfer(...) }');

// Disconnect wallet
await client.disconnectWallet();
// ✅ Wallet chain destroyed: chain_def456
// ✅ Public chain STILL ACTIVE: chain_abc123
// ✅ Subscriptions still working!
```

### Key Benefits

#### 1. **Persistent Subscriptions**
```typescript
// Subscribe in READ_ONLY mode
await app.public.systemMutate('mutation { subscribe(channelId: "abc") }');

// Connect wallet to send messages
await client.connectWallet(signer);
await app.wallet.mutate('mutation { sendMessage(...) }');

// Disconnect wallet
await client.disconnectWallet();

// ✅ Subscription STILL ACTIVE - continue receiving messages!
```

#### 2. **No User Prompts for Subscriptions**
```typescript
// Auto-signed on public chain - no wallet needed!
await app.public.systemMutate('mutation { subscribe(...) }'); // 🎉 No popup!
```

#### 3. **Stable Chain IDs & Addresses**
```typescript
const state = client.getState();

console.log(state.publicAddress);   // 0x742d35... (temporary)
console.log(state.publicChainId);   // chain_abc123
console.log(state.walletAddress);   // undefined
console.log(state.walletChainId);   // undefined

await client.connectWallet(signer1);

console.log(state.publicAddress);   // 0x742d35... (same!)
console.log(state.publicChainId);   // chain_abc123 (same!)
console.log(state.walletAddress);   // 0x123abc... (MetaMask)
console.log(state.walletChainId);   // chain_def456

await client.switchWallet(signer2);

console.log(state.publicAddress);   // 0x742d35... (same!)
console.log(state.publicChainId);   // chain_abc123 (same!)
console.log(state.walletAddress);   // 0x456def... (new wallet)
console.log(state.walletChainId);   // chain_ghi789 (new wallet chain)
```

### API: Public vs Wallet

#### **Public App** (Always Available)

```typescript
interface PublicApp {
  // Query on public chain
  query<T>(gql: string): Promise<T>;

  // System mutations (auto-signed, no user prompt)
  systemMutate<T>(gql: string): Promise<T>;

  // Get public address
  getAddress(): string;

  // Get public chain ID
  getChainId(): string;
}

// Usage
const app = await client.getApplication(appId);

// Always available, even without wallet
await app.public.query('{ balance }');
await app.public.systemMutate('mutation { subscribe(...) }');
```

#### **Wallet App** (Only When Wallet Connected)

```typescript
interface WalletApp {
  // Query on wallet chain
  query<T>(gql: string): Promise<T>;

  // User mutations (requires MetaMask signature)
  mutate<T>(gql: string): Promise<T>;

  // Get wallet address
  getAddress(): string;

  // Get wallet chain ID
  getChainId(): string;
}

// Usage
if (app.wallet) {
  // Wallet-specific operations
  await app.wallet.mutate('mutation { transfer(...) }');
  console.log('Wallet:', app.wallet.getAddress());
  console.log('Chain:', app.wallet.getChainId());

  // Query on wallet chain
  await app.wallet.query('{ balance }');
}
```


### Real-World Example: Chat App

```typescript
'use client';

import { useLineraClient, useApplication } from 'linera-react-client';

export function Chat({ channelId }: { channelId: string }) {
  const { isConnected } = useLineraClient();
  const { app, isReady } = useApplication(CHAT_APP_ID);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!isReady || !app) return;

    // Subscribe to messages on public chain (no wallet needed!)
    app.public.systemMutate(`
      mutation { subscribe(channelId: "${channelId}") }
    `).then(() => {
      console.log('Subscribed! Receiving messages...');
    });

    // Fetch messages on public chain
    const fetchMessages = async () => {
      const data = await app.public.query('{ messages }');
      setMessages(data.messages);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1000);
    return () => clearInterval(interval);
  }, [isReady, app, channelId]);

  const sendMessage = async (text: string) => {
    if (!app?.wallet) {
      alert('Please connect wallet to send messages');
      return;
    }

    // Send message on wallet chain (requires signature)
    await app.wallet.mutate(`
      mutation { sendMessage(text: "${text}") }
    `);
  };

  return (
    <div>
      <MessageList messages={messages} />
      {isConnected ? (
        <MessageInput onSend={sendMessage} />
      ) : (
        <p>Connect wallet to send messages</p>
      )}
    </div>
  );
}
```

**Key Benefits in This Example:**
- ✅ Users can read messages without wallet
- ✅ Subscription persists even if wallet disconnects
- ✅ No MetaMask popup for subscribing
- ✅ Only requires wallet for sending messages

## Blockchain Notifications

The SDK provides access to Linera's `onNotification()` API for listening to real-time blockchain events. Note that `onNotification()` is available on **Chain instances**, not on Client instances.

### Basic Usage with useLineraChain

The simplest way to listen to notifications is using the `useLineraChain` hook:

```typescript
'use client';

import { useLineraChain } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function NotificationListener({ chainId }: { chainId: string }) {
  const { chain, isReady } = useLineraChain(chainId);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isReady || !chain) return;

    // Listen to blockchain notifications on the chain
    const handler = (notification: any) => {
      console.log('Received notification:', notification);
      setNotifications(prev => [...prev, notification]);
    };

    chain.onNotification(handler);

    // Note: onNotification doesn't return an unsubscribe function
    // Cleanup happens when component unmounts or chain is destroyed
  }, [chain, isReady]);

  return (
    <div>
      <h2>Blockchain Notifications</h2>
      <ul>
        {notifications.map((notif, i) => (
          <li key={i}>{JSON.stringify(notif)}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Listening on Both Public and Wallet Chains

You can listen to notifications from both chains using the client manager:

```typescript
'use client';

import { useLineraClient } from 'linera-react-client';
import { getLineraClientManager } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function DualChainNotifications() {
  const { publicChainId, walletChainId, isConnected } = useLineraClient();
  const [publicNotifications, setPublicNotifications] = useState([]);
  const [walletNotifications, setWalletNotifications] = useState([]);

  // Listen to public chain notifications (always active)
  useEffect(() => {
    if (!publicChainId) return;

    const setupPublicChainListener = async () => {
      const clientManager = getLineraClientManager();
      if (!clientManager) return;

      const publicChain = await clientManager.getChain(publicChainId);

      publicChain.onNotification((notif: any) => {
        setPublicNotifications(prev => [...prev, notif]);
      });
    };

    setupPublicChainListener();
  }, [publicChainId]);

  // Listen to wallet chain notifications (only when wallet connected)
  useEffect(() => {
    if (!walletChainId || !isConnected) return;

    const setupWalletChainListener = async () => {
      const clientManager = getLineraClientManager();
      if (!clientManager) return;

      const walletChain = await clientManager.getChain(walletChainId);

      walletChain.onNotification((notif: any) => {
        setWalletNotifications(prev => [...prev, notif]);
      });
    };

    setupWalletChainListener();
  }, [walletChainId, isConnected]);

  return (
    <div>
      <div>
        <h3>Public Chain Notifications</h3>
        <p>Count: {publicNotifications.length}</p>
      </div>
      {isConnected && (
        <div>
          <h3>Wallet Chain Notifications</h3>
          <p>Count: {walletNotifications.length}</p>
        </div>
      )}
    </div>
  );
}
```

### Important Notes

- **API Change**: `onNotification()` is on Chain instances (not Client instances)
- Notifications are tied to the chain instance lifecycle
- Public chain notifications persist even when wallet disconnects
- Wallet chain notifications only work when wallet is connected
- Chain instances are cached by the client manager for efficient access

## Cross-Chain Querying

The SDK supports querying any chain directly via HTTP without needing to claim or open it first.

### Query Any Chain by ID

```typescript
'use client';

import { useApplication } from 'linera-react-client';
import { useState } from 'react';

export function CrossChainAuction() {
  const app = useApplication(APP_ID);
  const [auctionData, setAuctionData] = useState(null);

  const fetchFromCreatorChain = async () => {
    // Query a specific chain directly
    const data = await app.queryChain(
      'creator-chain-id-here',
      `query {
        auctionInfo {
          currentPrice
          quantityRemaining
          status
        }
      }`
    );
    setAuctionData(data);
  };

  return (
    <div>
      <button onClick={fetchFromCreatorChain}>
        Fetch from Creator Chain
      </button>
      {auctionData && (
        <div>
          <p>Price: {auctionData.auctionInfo.currentPrice}</p>
          <p>Available: {auctionData.auctionInfo.quantityRemaining}</p>
        </div>
      )}
    </div>
  );
}
```

### Static Query (Without Hook)

For queries outside React components or before client initialization:

```typescript
import { ApplicationClientImpl } from 'linera-react-client';

// Query any chain statically
const data = await ApplicationClientImpl.queryChainStatic(
  'http://localhost:8080',  // faucet URL
  'chain-id-to-query',       // target chain ID
  'your-app-id',             // application ID
  `query { auctionInfo { currentPrice } }`
);
```

### Use Cases

**1. Query Creator Chain for Live Data**
```typescript
// Find where the data lives and query it directly
const creatorData = await app.queryChain(creatorChainId, query);
```

**2. Query Multiple Chains**
```typescript
// Query different chains in parallel
const [chain1Data, chain2Data] = await Promise.all([
  app.queryChain('chain-1', query),
  app.queryChain('chain-2', query),
]);
```

**3. Cached Data + Live Fallback**
```typescript
// Try local cache first, fallback to creator chain
try {
  const cached = await app.query(cacheQuery);
  return cached;
} catch {
  const live = await app.queryChain(creatorChainId, liveQuery);
  return live;
}
```

## Logging Configuration

The SDK includes a configurable logging system that helps with debugging and monitoring.

### Basic Usage

```typescript
import { LineraProvider, LogLevel } from 'linera-react-client';

// Disable logging in production
<LineraProvider
  faucetUrl="http://localhost:8080"
  logging={process.env.NODE_ENV !== 'production'}
>
  {children}
</LineraProvider>

// Custom log level
<LineraProvider
  faucetUrl="http://localhost:8080"
  logging={{
    enabled: true,
    level: LogLevel.INFO,  // NONE, ERROR, WARN, INFO, DEBUG
    prefix: '[MyApp]',
  }}
>
  {children}
</LineraProvider>
```

### Using the Logger in Your Code

```typescript
import { logger } from 'linera-react-client';

// Simple usage
logger.info('User action completed');
logger.error('Failed to fetch data', error);
logger.debug('State updated', state);

// With type safety
logger.info('Transaction sent', { txId: '0x123', amount: 100 });
```

### Custom Logger Integration

Integrate with services like Sentry, LogRocket, etc.:

```typescript
import * as Sentry from '@sentry/react';

<LineraProvider
  faucetUrl="http://localhost:8080"
  logging={{
    enabled: true,
    level: LogLevel.ERROR,
    customLogger: {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: (msg, ...args) => {
        console.error(msg, ...args);
        Sentry.captureException(new Error(msg));
      },
    },
  }}
>
  {children}
</LineraProvider>
```

## Read-Only Wallet Configuration

The `readOnlyWallet` configuration controls how temporary wallets are created for guest/read-only mode (before users connect MetaMask). This is an important performance optimization.

### Why Constant Address is Recommended

In read-only mode, users only need to **query** applications, not perform write operations. The wallet is only used to claim a chain from the faucet for reading data.

**Problem with Random Wallets:**
- Every user creates a new random wallet
- Faucet creates a new chain for each wallet
- Wasted resources and slower initialization

**Solution with Constant Address:**
- All users share the same read-only wallet address
- Faucet can reuse the same chain for all users
- Zero overhead, instant initialization
- Same functionality for read-only operations

### Configuration Options

| Option | Use Case | Persistence | Performance |
|--------|----------|-------------|-------------|
| **Constant Address** | Production read-only (recommended) | N/A (same for all) | ⚡ Fastest |
| **localStorage** | User wants consistent wallet | Across sessions | 🚀 Fast |
| **sessionStorage** | Privacy + session persistence | Current session | 🚀 Fast |
| **Ephemeral (none)** | Maximum privacy | None | ⏱️ Slower |

### Example Configuration

```typescript
interface LineraProviderProps {
  faucetUrl: string;
  network?: 'mainnet' | 'testnet' | 'local';
  autoConnect?: boolean;
  skipProcessInbox?: boolean;
  readOnlyWallet?: {
    // Use constant address (recommended)
    constantAddress?: string;
    // OR use storage (only if constantAddress not provided)
    storage?: 'localStorage' | 'sessionStorage' | 'none';
    storageKey?: string;
  };
  logging?: boolean | {
    enabled?: boolean;
    level?: LogLevel;
    prefix?: string;
    customLogger?: CustomLogger;
  };
}
```

## API Reference

### Hooks

#### `useLineraClient()`

Main hook for accessing Linera client functionality.

```typescript
const {
  // Dual-chain clients
  publicClient,    // Public client (queries, system ops) - always available
  walletClient,    // Wallet client (user mutations) - only when wallet connected

  // Wallet instance
  wallet,          // Wallet instance

  // State
  isInitialized,   // Is client initialized
  isReadOnly,      // Is in read-only mode (guest)
  isConnected,     // Is wallet connected
  canWrite,        // Can perform write operations
  error,           // Any error that occurred

  // Addresses
  walletAddress,   // Connected wallet address (MetaMask)
  publicAddress,   // Public (temporary) address (always available)

  // Chain IDs
  publicChainId,   // Public chain ID (always available)
  walletChainId,   // Wallet chain ID (only when wallet connected)

  // Methods
  getApplication,  // Get application client
} = useLineraClient();
```

**Key Features:**
- `publicClient` and `walletClient` provide access to the Client API
- Dual chain IDs: `publicChainId` (always available) and `walletChainId` (when wallet connected)
- Dual addresses: `publicAddress` (temporary) and `walletAddress` (MetaMask)
- **Note**: For blockchain notifications, use `chain.onNotification()` on chain instances (not client instances)

#### `useWalletConnection()`

Hook for managing wallet connections.

```typescript
const {
  isMetaMaskInstalled, // Is MetaMask installed
  isConnected,         // Is wallet connected
  isConnecting,        // Is connecting
  address,             // Connected wallet address
  chainId,             // Claimed chain ID
  error,               // Connection error
  connect,             // Connect MetaMask wallet
  disconnect,          // Disconnect wallet
} = useWalletConnection();
```

#### `useApplication(appId: string)`

Hook for accessing a specific Linera application.

```typescript
const {
  app,         // Application client with public and wallet interfaces
  isReady,     // Is client ready
  isLoading,   // Is loading application
  canWrite,    // Can perform write operations
} = useApplication(APP_ID);
```

**Application Client with Dual-Chain Support**

```typescript
// Public App - Always available
await app.public.query<T>('{ balance }');
await app.public.systemMutate<T>('mutation { subscribe(...) }');

// Wallet App - Only when wallet connected
if (app.wallet) {
  await app.wallet.mutate<T>('mutation { transfer(...) }');
  const address = app.wallet.getAddress();
  const chainId = app.wallet.getChainId();

  // Query on wallet chain
  await app.wallet.query<T>('{ balance }');
}
```

**Static Method (for use outside React components):**

```typescript
import { ApplicationClientImpl } from 'linera-react-client';

// Query any chain without hooks
const data = await ApplicationClientImpl.queryChainStatic<T>(
  'http://localhost:8080',  // faucet URL
  'chain-id',                // target chain ID
  'app-id',                  // application ID
  'query { ... }'            // GraphQL query
);
```

### Components

#### `LineraProvider`

Provider component that initializes the Linera client.

```typescript
interface LineraProviderProps {
  children: React.ReactNode;
  faucetUrl: string;
  network?: 'mainnet' | 'testnet' | 'local';
  autoConnect?: boolean;
  skipProcessInbox?: boolean;
  readOnlyWallet?: ReadOnlyWalletConfig;
  logging?: boolean | LoggerConfig;
}
```

### Configuration Helpers

#### Next.js: `withLinera(nextConfig, lineraConfig)`

Next.js configuration wrapper that adds required headers and external packages.

```typescript
import { withLinera } from 'linera-react-client/config/nextjs';

export default withLinera(
  {
    // Your Next.js config
  },
  {
    enableHeaders: true,      // Enable COOP/COEP headers (default: true)
    customHeaders: [],        // Additional custom headers
  }
);
```

**What it does:**
- ✅ Adds `@linera/client` to `serverExternalPackages`
- ✅ Sets required COOP/COEP headers for SharedArrayBuffer
- ✅ Allows custom headers configuration

#### Vite: `lineraPlugin(options)` & `withLinera(viteConfig, lineraConfig)`

**Option 1: Plugin (Recommended)**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lineraPlugin } from 'linera-react-client/config/vite';

export default defineConfig({
  plugins: [
    react(),
    lineraPlugin({
      enableHeaders: true,     // Enable COOP/COEP headers (default: true)
      customHeaders: {},       // Additional headers
    }),
  ],
});
```

**Option 2: Complete Config Helper**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withLinera } from 'linera-react-client/config/vite';

export default defineConfig(
  withLinera({
    plugins: [react()],
    // Your other Vite config
  }, {
    enableHeaders: true,
    customHeaders: {},
  })
);
```

**What it does:**
- ✅ Sets required COOP/COEP headers (dev & preview servers)
- ✅ Marks `@linera/client` as external in build
- ✅ Excludes `@linera/client` from optimization
- ✅ Enables top-level-await support

**Configuration Options:**

```typescript
interface LineraViteConfig {
  enableHeaders?: boolean;              // Enable COOP/COEP headers (default: true)
  customHeaders?: Record<string, string>; // Additional headers
}
```

#### Create React App (CRACO): `createLineraConfig()`

For Create React App projects using CRACO for custom configuration.

```javascript
// craco.config.js
const { createLineraConfig } = require('linera-react-client/config/craco');

module.exports = createLineraConfig();
```

**With custom configuration:**

```javascript
// craco.config.js
const { createLineraConfig } = require('linera-react-client/config/craco');

const lineraConfig = createLineraConfig();

module.exports = {
  ...lineraConfig,
  // Your other CRACO config
  webpack: {
    ...lineraConfig.webpack,
    // Additional webpack config
  }
};
```

**What it does:**
- ✅ Configures webpack dev server with COOP/COEP headers
- ✅ Enables SharedArrayBuffer support for Linera WASM
- ✅ Compatible with existing CRACO configurations

**Installation:**
```bash
npm install @craco/craco --save-dev
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "start": "craco start",
    "build": "craco build",
    "test": "craco test"
  }
}
```

#### Generic Webpack: `withLinera(webpackConfig, config)`

For projects using plain Webpack or custom build setups.

```javascript
// webpack.config.js
const { withLinera } = require('linera-react-client/config/webpack');

module.exports = withLinera({
  entry: './src/index.js',
  // Your other webpack config
});
```

**With custom headers:**

```javascript
// webpack.config.js
const { withLinera } = require('linera-react-client/config/webpack');

module.exports = withLinera(
  {
    entry: './src/index.js',
    // Your webpack config
  },
  {
    enableHeaders: true,
    customHeaders: {
      'X-Custom-Header': 'value'
    }
  }
);
```

**What it does:**
- ✅ Adds COOP/COEP headers to webpack dev server
- ✅ Supports custom header configuration
- ✅ Works with any webpack-based setup

**Configuration Options:**

```typescript
interface LineraWebpackConfig {
  enableHeaders?: boolean;              // Enable COOP/COEP headers (default: true)
  customHeaders?: Record<string, string>; // Additional headers
}
```

## Local Development

### Testing the SDK locally

1. **Build the SDK:**
```bash
cd linera-react-client
npm install
npm run build
```

2. **Link it locally (Option A):**
```bash
# In the SDK directory
npm link

# In your project directory
cd ../your-project
npm link linera-react-client
```

3. **Or use file path (Option B):**
```json
// In your project's package.json
{
  "dependencies": {
    "linera-react-client": "file:../linera-react-client"
  }
}
```

4. **Watch for changes during development:**
```bash
cd linera-react-client
npm run dev
```

### Available Scripts

- `npm run build` - Build the library (CJS + ESM + Types)
- `npm run dev` - Watch mode for development
- `npm run type-check` - Type check without building
- `npm run clean` - Remove build output

## Features

- ✅ **Dual-chain architecture (v1.1.0+)** - Separate public and wallet chains for better UX
  - ✅ Persistent subscriptions across wallet connections
  - ✅ No user prompts for cross-chain subscriptions
  - ✅ Stable chain IDs
  - ✅ Access to both publicClient and walletClient with full API
- ✅ **Performance optimizations** - Fixed re-render issues and race conditions
  - ✅ Optimized wallet reconnection (no unnecessary re-renders)
  - ✅ Fixed stale reference checks
  - ✅ Eliminated state synchronization race conditions
- ✅ React hooks for Linera client
- ✅ Wallet connection management (MetaMask)
- ✅ Read-only mode with temporary wallets
- ✅ Application query and mutation
- ✅ **Blockchain notifications** - Listen to real-time events via chain.onNotification() on chain instances
- ✅ **Cross-chain querying** - Query any chain by ID via HTTP
- ✅ **System mutations** - Auto-signed operations without wallet prompts
- ✅ Full TypeScript support with type definitions
- ✅ Framework configuration helpers:
  - ✅ Next.js
  - ✅ Vite
  - ✅ Create React App (CRACO)
  - ✅ Generic Webpack
- ✅ **Automatic asset management** (postinstall script)
- ✅ Configurable logging system
- ✅ ESM and CJS builds
- ✅ Tree-shakeable exports
- ✅ Small bundle size (~30KB)

## Requirements

- **React** >= 18.0.0
- **React DOM** >= 18.0.0
- **Next.js** >= 13.0.0 (if using Next.js)
- **MetaMask** browser extension (for wallet features)

## Project Structure

```
linera-react-client/
├── src/
│   ├── hooks/              # React hooks
│   │   ├── useLineraClient.ts
│   │   ├── useWalletConnection.ts
│   │   └── useLineraApplication.ts
│   ├── providers/          # React providers
│   │   └── LineraProvider.tsx
│   ├── lib/
│   │   ├── linera/         # Core Linera client logic
│   │   │   ├── client-manager.ts
│   │   │   ├── application-client.ts
│   │   │   └── temporary-signer.ts
│   │   └── signers/        # Signer implementations
│   ├── config/             # Framework configuration helpers
│   │   ├── nextjs.ts       # Next.js config
│   │   ├── vite.ts         # Vite config
│   │   ├── craco.ts        # Create React App (CRACO)
│   │   └── webpack.ts      # Generic Webpack
│   ├── utils/              # Utilities
│   │   └── logger.ts       # Configurable logger
│   └── index.ts            # Main exports
├── scripts/
│   └── postinstall.js      # Asset copy script
├── dist/                   # Build output
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Examples

See the [examples](./examples) directory for complete working examples:
- Next.js App Router
- Next.js Pages Router
- Vite + React
- Create React App (with CRACO)
- Generic Webpack Setup

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Author

**Wisdom Abioye**

## Repository

https://github.com/wisdomabioye/linera-react-client

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
