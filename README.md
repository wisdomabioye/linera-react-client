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

**NEW: Using Dual-Chain Architecture (Recommended)**

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
      // Use publicClient for queries - always available
      const result = await app.publicClient.query<{ auctions: Auction[] }>(
        '{ "query": "query { auctions }" }'
      );
      setAuctions(result.auctions);
    };

    fetchAuctions();
  }, [isReady, app]);

  const handleBid = async (auctionId: string, amount: number) => {
    if (!app?.walletClient) {
      alert('Please connect your wallet first');
      return;
    }

    // Use walletClient for user mutations - requires wallet connection
    await app.walletClient.mutate(`{
      "query": "mutation { placeBid(auctionId: \\"${auctionId}\\", amount: ${amount}) }"
    }`);
  };

  const handleSubscribe = async (channelId: string) => {
    if (!app) return;

    // Use publicClient.systemMutate for subscriptions - no wallet needed!
    await app.publicClient.systemMutate(`
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

**Legacy API (Still Supported, Deprecated)**

```typescript
'use client';

import { useApplication, OperationType } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function AuctionList() {
  const { query, mutate, isReady, canWrite } = useApplication(APP_ID);
  const [auctions, setAuctions] = useState([]);

  useEffect(() => {
    if (!isReady) return;

    const fetchAuctions = async () => {
      const result = await query<{ auctions: Auction[] }>(
        '{ "query": "query { auctions }" }'
      );
      setAuctions(result.auctions);
    };

    fetchAuctions();
  }, [isReady, query]);

  const handleBid = async (auctionId: string, amount: number) => {
    if (!canWrite) {
      alert('Please connect your wallet first');
      return;
    }

    await mutate(`{
      "query": "mutation { placeBid(auctionId: \\"${auctionId}\\", amount: ${amount}) }"
    }`);
  };

  return (
    <div>
      {auctions.map(auction => (
        <AuctionCard key={auction.id} auction={auction} onBid={handleBid} />
      ))}
    </div>
  );
}
```

## Recent Improvements ✨

**Latest Updates** - Performance and stability improvements for better developer experience.

### Bug Fixes & Optimizations

#### Fixed Stale Reference Checks (application-client.ts)
- **Issue**: WalletClient methods had circular reference checks (`this.walletClient` checking itself)
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
await app.publicClient.query('{ balance }');

// Subscribe on public chain (auto-signed, no user prompt!)
await app.publicClient.systemMutate('mutation { subscribe(...) }');

// Connect wallet
await client.connectWallet(metamaskSigner);
// ✅ Wallet chain claimed: chain_def456 (MetaMask signer)
// ✅ Public chain STILL ACTIVE: chain_abc123

// User mutations on wallet chain (requires signature)
await app.walletClient.mutate('mutation { transfer(...) }');

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
await app.publicClient.systemMutate('mutation { subscribe(channelId: "abc") }');

// Connect wallet to send messages
await client.connectWallet(signer);
await app.walletClient.mutate('mutation { sendMessage(...) }');

// Disconnect wallet
await client.disconnectWallet();

// ✅ Subscription STILL ACTIVE - continue receiving messages!
```

#### 2. **No User Prompts for Subscriptions**
```typescript
// OLD WAY: Required wallet connection and user signature
await connectWallet();
await app.mutate('mutation { subscribe(...) }'); // 😓 MetaMask popup

// NEW WAY: Auto-signed on public chain
await app.publicClient.systemMutate('mutation { subscribe(...) }'); // 🎉 No popup!
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

### API: PublicClient vs WalletClient

#### **PublicClient** (Always Available)

```typescript
interface PublicClient {
  // Query on public chain
  query<T>(gql: string): Promise<T>;

  // Query any chain via HTTP
  queryChain<T>(chainId: string, gql: string): Promise<T>;

  // System mutations (auto-signed, no user prompt)
  systemMutate<T>(gql: string): Promise<T>;
}

// Usage
const app = await client.getApplication(appId);

// Always available, even without wallet
await app.publicClient.query('{ balance }');
await app.publicClient.queryChain('other-chain-id', '{ data }');
await app.publicClient.systemMutate('mutation { subscribe(...) }');
```

#### **WalletClient** (Only When Wallet Connected)

```typescript
interface WalletClient extends PublicClient {
  // User mutations (requires MetaMask signature)
  mutate<T>(gql: string): Promise<T>;

  // Get wallet address
  getAddress(): string;

  // Get wallet chain ID
  getChainId(): string;
}

// Usage
if (app.walletClient) {
  // Wallet-specific operations
  await app.walletClient.mutate('mutation { transfer(...) }');
  console.log('Wallet:', app.walletClient.getAddress());
  console.log('Chain:', app.walletClient.getChainId());

  // Also has all publicClient methods
  await app.walletClient.query('{ balance }');
}
```

### Migration from Legacy API

The legacy API is still supported but deprecated. Here's how to migrate:

#### **Queries**

```typescript
// OLD (Deprecated)
const data = await app.query('{ balance }');

// NEW (Recommended)
const data = await app.publicClient.query('{ balance }');
```

#### **User Mutations**

```typescript
// OLD (Deprecated)
if (canWrite) {
  await app.mutate('mutation { transfer(...) }');
}

// NEW (Recommended)
if (app.walletClient) {
  await app.walletClient.mutate('mutation { transfer(...) }');
}
```

#### **System Mutations (NEW!)**

```typescript
// OLD (Required operationType parameter)
await app.mutate('mutation { subscribe(...) }', {
  operationType: OperationType.SYSTEM
});

// NEW (Cleaner, explicit)
await app.publicClient.systemMutate('mutation { subscribe(...) }');
```

#### **Cross-Chain Queries**

```typescript
// OLD (Deprecated)
const data = await app.queryChain('chain-id', '{ data }');

// NEW (Recommended)
const data = await app.publicClient.queryChain('chain-id', '{ data }');
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
    app.publicClient.systemMutate(`
      mutation { subscribe(channelId: "${channelId}") }
    `).then(() => {
      console.log('Subscribed! Receiving messages...');
    });

    // Fetch messages on public chain
    const fetchMessages = async () => {
      const data = await app.publicClient.query('{ messages }');
      setMessages(data.messages);
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 1000);
    return () => clearInterval(interval);
  }, [isReady, app, channelId]);

  const sendMessage = async (text: string) => {
    if (!app?.walletClient) {
      alert('Please connect wallet to send messages');
      return;
    }

    // Send message on wallet chain (requires signature)
    await app.walletClient.mutate(`
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

The SDK provides access to Linera's `onNotification()` API for listening to real-time blockchain events through both `publicClient` and `walletClient`.

### Using Notifications with useLineraClient

```typescript
'use client';

import { useLineraClient } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function NotificationListener() {
  const { publicClient, isInitialized } = useLineraClient();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isInitialized || !publicClient) return;

    // Listen to blockchain notifications
    const handler = (notification: any) => {
      console.log('Received notification:', notification);
      setNotifications(prev => [...prev, notification]);
    };

    publicClient.onNotification(handler);

    // Note: onNotification doesn't return an unsubscribe function
    // Cleanup happens when component unmounts or client is destroyed
  }, [publicClient, isInitialized]);

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

### Listening on Both Chains

You can listen to notifications from both public and wallet chains:

```typescript
'use client';

import { useLineraClient } from 'linera-react-client';
import { useEffect, useState } from 'react';

export function DualChainNotifications() {
  const { publicClient, walletClient, isConnected } = useLineraClient();
  const [publicNotifications, setPublicNotifications] = useState([]);
  const [walletNotifications, setWalletNotifications] = useState([]);

  // Listen to public chain notifications (always active)
  useEffect(() => {
    if (!publicClient) return;

    publicClient.onNotification((notif: any) => {
      setPublicNotifications(prev => [...prev, notif]);
    });
  }, [publicClient]);

  // Listen to wallet chain notifications (only when wallet connected)
  useEffect(() => {
    if (!walletClient || !isConnected) return;

    walletClient.onNotification((notif: any) => {
      setWalletNotifications(prev => [...prev, notif]);
    });
  }, [walletClient, isConnected]);

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

- Notifications are tied to the client instance lifecycle
- When the client is destroyed or reinitialized, notification handlers are cleared
- Public chain notifications persist even when wallet disconnects
- Wallet chain notifications only work when wallet is connected

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
  publicClient,    // Public client (queries, system ops, notifications) - always available
  walletClient,    // Wallet client (user mutations, notifications) - only when wallet connected

  client,          // Deprecated: use publicClient or walletClient
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
  chainId,         // Deprecated: returns walletChainId || publicChainId

  // Methods
  getApplication,  // Get application client
} = useLineraClient();
```

**New in this version:**
- `publicClient` and `walletClient` expose the full Client API including `onNotification()`
- Access to both chain IDs: `publicChainId` and `walletChainId`
- Access to both addresses: `publicAddress` and `walletAddress`

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
  app,         // Application client with publicClient and walletClient
  isReady,     // Is client ready
  isLoading,   // Is loading application

  // Legacy API (deprecated)
  canWrite,    // Can perform write operations
  query,       // Execute a query (deprecated, use app.publicClient.query)
  mutate,      // Execute a mutation (deprecated, use app.publicClient.systemMutate or app.walletClient.mutate)
  queryChain,  // Query any chain by ID (deprecated, use app.publicClient.queryChain)
} = useApplication(APP_ID);
```

**NEW: Application Client with Dual-Chain Support**

```typescript
// PublicClient - Always available
await app.publicClient.query<T>('{ balance }');
await app.publicClient.queryChain<T>('other-chain-id', '{ data }');
await app.publicClient.systemMutate<T>('mutation { subscribe(...) }');

// WalletClient - Only when wallet connected
if (app.walletClient) {
  await app.walletClient.mutate<T>('mutation { transfer(...) }');
  const address = app.walletClient.getAddress();
  const chainId = app.walletClient.getChainId();

  // WalletClient extends PublicClient
  await app.walletClient.query<T>('{ balance }');
}
```

**Legacy Application Client Methods (Deprecated):**

```typescript
// Query current chain (deprecated)
const data = await app.query<T>('query { ... }');

// Mutate (requires wallet connection, deprecated)
const result = await app.mutate<T>('mutation { ... }');

// System mutation with operationType (deprecated)
const result = await app.mutate<T>('mutation { subscribe(...) }', {
  operationType: OperationType.SYSTEM
});

// Query any chain by ID (deprecated)
const crossChainData = await app.queryChain<T>(
  'target-chain-id',
  'query { ... }'
);
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
- ✅ **Blockchain notifications** - Listen to real-time events via onNotification()
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
