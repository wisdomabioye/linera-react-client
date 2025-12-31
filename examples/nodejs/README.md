# Node.js Examples

> **⚠️ IMPORTANT:** `@linera/client` uses Web Workers which are **browser-only**. Full client initialization fails in Node.js. These examples demonstrate the API but cannot run successfully.

## Limitation

`@linera/client` requires:
- Web Workers (browser-only, no Node.js equivalent)
- Browser APIs for blockchain operations

**Result:** Client initialization works partially but fails when attempting to use Web Workers.

## For Production

**Use the browser/React environment:**
- ✅ Full client functionality
- ✅ Wallet connection with MetaMask
- ✅ All mutations and queries
- ✅ React hooks (`useLineraClient`, `useLineraApplication`)

See the main [README](../../README.md) for browser setup.

## Code Examples (For Reference Only)

These examples show how the API would be used, but **will fail** due to Web Workers limitation.

```bash
cd examples/nodejs
npm install
npm run mock  # Will fail with "Worker is not defined"
```

## What the Code Demonstrates

The example files show proper API usage:
- Client creation and configuration
- Environment detection (browser vs Node.js)
- State management patterns
- Error handling
- Resource cleanup

## Known Error

When run, examples fail with:
```
ReferenceError: Worker is not defined
```

This is **expected** - `@linera/client` WASM requires Web Workers (browser-only).

## Alternative for Node.js

If you need server-side Linera integration:
1. Use HTTP/REST APIs to communicate with Linera nodes
2. Use a headless browser (Puppeteer/Playwright) to run the browser version
3. Wait for official Node.js support from Linera
