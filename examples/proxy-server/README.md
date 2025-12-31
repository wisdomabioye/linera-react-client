# Linera Proxy Server

A proxy server that runs `linera-react-client` in a headless browser (Puppeteer) and exposes REST APIs for your frontend clients.

## Why This Approach?

- ✅ **Works in Node.js environment** (via headless browser)
- ✅ **Single Linera connection** shared across all clients
- ✅ **Web Workers work** (browser environment)
- ✅ **Simple frontend** (just HTTP calls, no WASM)
- ✅ **Better performance** (one connection vs many)
- ✅ **Centralized state management**

## Architecture

```
┌─────────────────────────────────────────┐
│     Browser/Mobile Clients              │
│     (Your users)                        │
└────────────┬────────────────────────────┘
             │ HTTP/REST
             ▼
┌─────────────────────────────────────────┐
│   Proxy Server (This)                   │
│   ┌───────────────────────────────────┐ │
│   │  Express.js API                   │ │
│   │  ↓                                │ │
│   │  Puppeteer (Headless Browser)     │ │
│   │  ├─ linera-react-client (WASM)   │ │
│   │  ├─ Web Workers ✅                │ │
│   │  └─ Blockchain State              │ │
│   └───────────────────────────────────┘ │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│      Linera Network                     │
└─────────────────────────────────────────┘
```

## Setup

```bash
cd examples/proxy-server

# Install dependencies
npm install

# Start the server
npm start

# Or with custom faucet
FAUCET_URL=http://localhost:8080 npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "ready": true,
  "timestamp": "2025-12-31T13:00:00.000Z"
}
```

### Get Client State
```bash
GET /api/state
```

Response:
```json
{
  "success": true,
  "state": {
    "mode": "read_only",
    "isInitialized": true,
    "hasWallet": false,
    "publicChainId": "b5551d5b...",
    "publicAddress": "0x30B632...",
    "faucetUrl": "https://faucet.testnet-conway.linera.net"
  }
}
```

### Execute Query
```bash
POST /api/query
Content-Type: application/json

{
  "appId": "e476187f...",
  "query": "query { balance }",
  "options": {}
}
```

Response:
```json
{
  "success": true,
  "data": {
    "balance": 1000
  }
}
```

### Execute System Mutation
```bash
POST /api/mutate
Content-Type: application/json

{
  "appId": "e476187f...",
  "mutation": "mutation { transfer(to: \"0x123\", amount: 100) }",
  "options": {}
}
```

Response:
```json
{
  "success": true,
  "data": {
    "transactionId": "abc123..."
  }
}
```

### Get Chain Info
```bash
GET /api/chain/:chainId
```

Response:
```json
{
  "success": true,
  "data": {
    "chainId": "b5551d5b..."
  }
}
```

## Usage Examples

### JavaScript/TypeScript Client

```typescript
// client.ts
class LineraClient {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async query(appId: string, query: string) {
    const response = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, query })
    });
    return await response.json();
  }

  async mutate(appId: string, mutation: string) {
    const response = await fetch(`${this.baseUrl}/api/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, mutation })
    });
    return await response.json();
  }

  async getState() {
    const response = await fetch(`${this.baseUrl}/api/state`);
    return await response.json();
  }
}

// Usage
const client = new LineraClient();

const result = await client.query(
  'e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000',
  'query { balance }'
);

console.log(result);
```

### React Component

```tsx
import { useState, useEffect } from 'react';

function MyApp() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    async function fetchBalance() {
      const response = await fetch('http://localhost:3001/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: 'your-app-id',
          query: 'query { balance }'
        })
      });

      const data = await response.json();
      if (data.success) {
        setBalance(data.data.balance);
      }
    }

    fetchBalance();
  }, []);

  return <div>Balance: {balance}</div>;
}
```

### cURL Examples

```bash
# Get state
curl http://localhost:3001/api/state

# Execute query
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "e476187f6ddfeb9d588c7b45d3df334d5501d6499b3f9ad5595cae86cce16a65010000000000000000000000",
    "query": "query { __typename }"
  }'

# Execute mutation
curl -X POST http://localhost:3001/api/mutate \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "your-app-id",
    "mutation": "mutation { transfer(to: \"0x123\", amount: 100) }"
  }'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `FAUCET_URL` | `https://faucet.testnet-conway.linera.net` | Linera faucet URL |

## Production Deployment

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies including Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to skip download (use system chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

### Process Manager (PM2)

```bash
npm install -g pm2

pm2 start npm --name "linera-proxy" -- start
pm2 save
pm2 startup
```

## Monitoring

The server logs all operations:

```
[Headless] Initializing Linera client with config: { faucetUrl: '...' }
[Headless] Client initialized: { mode: 'read_only', ... }
[Headless] Executing query on app: e476187f...
[Headless] Query result: { balance: 1000 }
```

## Troubleshooting

**Puppeteer fails to launch:**
```bash
# Install required dependencies
sudo apt-get install -y chromium-browser
```

**Memory issues:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**WASM initialization fails:**
- Make sure the parent package is built: `cd ../.. && npm run build`
- Check that `dist/index.js` exists

## Limitations

- 🟡 Single browser instance (horizontal scaling requires session management)
- 🟡 Higher memory usage (~100-200MB per instance)
- 🟡 Not suitable for serverless (requires long-running process)

## Advantages Over Direct Client

| Feature | Direct Client | Proxy Server |
|---------|--------------|--------------|
| Node.js Support | ❌ | ✅ |
| Shared State | ❌ | ✅ |
| Single Connection | ❌ | ✅ |
| Simple Frontend | ❌ | ✅ |
| Memory Usage | Low | Medium |
| Scalability | Per-client | Centralized |

## Next Steps

1. Add authentication/API keys
2. Add WebSocket support for subscriptions
3. Add request caching
4. Add rate limiting
5. Add multiple chain support
6. Add wallet management for user-signed transactions

## License

MIT
