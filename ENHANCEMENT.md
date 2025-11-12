# Linera React SDK - Enhancement Plan

## Overview

This document outlines the comprehensive plan to extract the Linera client integration into a reusable, production-ready NPM library that can be used across multiple frameworks (Next.js, Vite, Create React App, etc.).

## Library Structure

### Package Name
`@linera/react-sdk` or `linera-react-sdk`

### Directory Structure
```
linera-react-sdk/
├── src/
│   ├── hooks/                    # React hooks
│   │   ├── index.ts
│   │   ├── useLineraClient.ts
│   │   ├── useWalletConnection.ts
│   │   └── useLineraApplication.ts
│   ├── providers/                # React providers
│   │   ├── index.ts
│   │   └── LineraProvider.tsx
│   ├── lib/                      # Core library logic
│   │   ├── linera/
│   │   │   ├── index.ts
│   │   │   ├── client-manager.ts
│   │   │   ├── application-client.ts
│   │   │   ├── temporary-signer.ts
│   │   │   ├── linera-loader.ts
│   │   │   ├── linera-types.ts
│   │   │   └── types.ts
│   │   └── signers/              # Signer implementations
│   │       ├── index.ts
│   │       ├── metamask-signer.ts
│   │       └── temporary-signer.ts (re-export)
│   ├── utils/                    # Utility functions
│   │   ├── index.ts
│   │   ├── logger.ts
│   │   └── storage.ts
│   ├── config/                   # Configuration helpers
│   │   ├── index.ts
│   │   ├── nextjs.ts
│   │   ├── vite.ts
│   │   └── webpack.ts
│   └── index.ts                  # Main entry point
├── scripts/
│   ├── postinstall.js            # Post-install script
│   └── copy-linera-files.js      # Copy Linera assets
├── tests/                        # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── examples/                     # Example implementations
│   ├── nextjs/
│   ├── vite/
│   └── cra/
├── docs/                         # Documentation
│   ├── getting-started.md
│   ├── api-reference.md
│   └── migration-guide.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── publish.yml
├── package.json
├── tsconfig.json
├── rollup.config.js              # or tsup.config.ts
├── jest.config.js
├── .eslintrc.js
├── .prettierrc
├── LICENSE
└── README.md
```

---

## Key Enhancements

### 1. Persistent Temporary Signer (Wallet Persistence) ✅

**Current Issue:**
- `TemporarySigner` creates a new random wallet on every page reload
- Users lose access to claimed chains and assets
- Poor UX for guest/read-only mode

**Solution:**
Implement multiple persistence strategies with user choice:

#### Strategy 1: Browser LocalStorage (Default)
```typescript
// lib/signers/persistent-temporary-signer.ts
export class PersistentTemporarySigner implements Signer {
  private wallet: ethers.Wallet;
  private storageKey = 'linera_temp_wallet';

  constructor(options?: { storageKey?: string }) {
    this.storageKey = options?.storageKey || this.storageKey;
    this.wallet = this.loadOrCreateWallet();
  }

  private loadOrCreateWallet(): ethers.Wallet {
    const stored = localStorage.getItem(this.storageKey);

    if (stored) {
      try {
        const { privateKey } = JSON.parse(stored);
        return new ethers.Wallet(privateKey);
      } catch (error) {
        console.warn('[PersistentTemporarySigner] Failed to load wallet, creating new one');
      }
    }

    const wallet = ethers.Wallet.createRandom();
    this.saveWallet(wallet);
    return wallet;
  }

  private saveWallet(wallet: ethers.Wallet): void {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify({ privateKey: wallet.privateKey })
    );
  }

  clearWallet(): void {
    localStorage.removeItem(this.storageKey);
  }

  // ... implement Signer interface
}
```

#### Strategy 2: SessionStorage (Session-only)
```typescript
export class SessionTemporarySigner implements Signer {
  // Similar to PersistentTemporarySigner but uses sessionStorage
  // Wallet persists during browser session but clears on tab close
}
```

#### Strategy 3: In-Memory (Current behavior)
```typescript
export class EphemeralTemporarySigner implements Signer {
  // Current TemporarySigner implementation
  // No persistence - new wallet on every reload
}
```

#### Strategy 4: Encrypted LocalStorage (Advanced)
```typescript
export class EncryptedTemporarySigner implements Signer {
  // Uses Web Crypto API to encrypt private key before storing
  // Requires user-provided password or device fingerprint
}
```

**Configuration:**
```typescript
interface LineraProviderProps {
  temporarySignerStrategy?: 'persistent' | 'session' | 'ephemeral' | 'encrypted';
  temporarySignerOptions?: {
    storageKey?: string;
    encryptionPassword?: string;
  };
}
```

---

### 2. Configurable Logging System ✅

**Current Issue:**
- Console logs are hardcoded throughout the codebase
- No way to disable logs in production
- No structured logging or log levels

**Solution:**
Implement a flexible logging system with environment-aware defaults:

```typescript
// utils/logger.ts
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix?: string;
  customLogger?: {
    debug: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    error: (message: string, ...args: any[]) => void;
  };
}

export class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enabled: process.env.NODE_ENV !== 'production',
      level: process.env.NODE_ENV === 'production' ? LogLevel.ERROR : LogLevel.DEBUG,
      prefix: '[Linera SDK]',
      ...config,
    };
  }

  debug(message: string, ...args: any[]): void {
    if (this.config.enabled && this.config.level >= LogLevel.DEBUG) {
      const logger = this.config.customLogger?.debug || console.debug;
      logger(`${this.config.prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.config.enabled && this.config.level >= LogLevel.INFO) {
      const logger = this.config.customLogger?.info || console.info;
      logger(`${this.config.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.config.enabled && this.config.level >= LogLevel.WARN) {
      const logger = this.config.customLogger?.warn || console.warn;
      logger(`${this.config.prefix} ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.config.enabled && this.config.level >= LogLevel.ERROR) {
      const logger = this.config.customLogger?.error || console.error;
      logger(`${this.config.prefix} ${message}`, ...args);
    }
  }
}

// Global logger instance
let logger: Logger;

export function createLogger(config?: Partial<LoggerConfig>): Logger {
  logger = new Logger(config);
  return logger;
}

export function getLogger(): Logger {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
}
```

**Provider Integration:**
```typescript
interface LineraProviderProps {
  children: React.ReactNode;
  faucetUrl: string;
  autoConnect?: boolean;

  // Logging configuration
  logging?: boolean | Partial<LoggerConfig>;
}

export function LineraProvider({
  logging = process.env.NODE_ENV !== 'production',
  ...props
}: LineraProviderProps) {
  useEffect(() => {
    // Initialize logger
    const logConfig = typeof logging === 'boolean'
      ? { enabled: logging }
      : logging;
    createLogger(logConfig);
  }, [logging]);

  // ... rest of provider
}
```

---

### 3. Automated Versioning and Release ✅

**Tools:**
- **semantic-release**: Automated versioning based on commit messages
- **conventional-changelog**: Generate changelogs automatically
- **husky**: Git hooks for commit message enforcement
- **commitlint**: Lint commit messages

**Setup:**

#### package.json scripts
```json
{
  "scripts": {
    "build": "tsup",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit",
    "prepare": "husky install",
    "semantic-release": "semantic-release"
  },
  "release": {
    "branches": ["main", "next"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/changelog",
      "@semantic-release/npm",
      "@semantic-release/github",
      [
        "@semantic-release/git",
        {
          "assets": ["package.json", "CHANGELOG.md"],
          "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
        }
      ]
    ]
  }
}
```

#### Commit Convention (Conventional Commits)
```
feat: new feature (triggers minor version bump)
fix: bug fix (triggers patch version bump)
perf: performance improvement (triggers patch version bump)
docs: documentation only changes (no version bump)
style: code style changes (no version bump)
refactor: code refactoring (no version bump)
test: test changes (no version bump)
chore: maintenance tasks (no version bump)
ci: CI configuration changes (no version bump)

BREAKING CHANGE: (triggers major version bump)
```

#### GitHub Actions Workflow (.github/workflows/release.yml)
```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
          persist-credentials: false

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

#### Commitlint Configuration (.commitlintrc.js)
```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature (minor)
        'fix',      // Bug fix (patch)
        'perf',     // Performance improvement (patch)
        'docs',     // Documentation
        'style',    // Code style
        'refactor', // Code refactoring
        'test',     // Tests
        'build',    // Build system
        'ci',       // CI configuration
        'chore',    // Maintenance
        'revert',   // Revert commit
      ],
    ],
  },
};
```

---

### 4. Comprehensive Test Suites

**Testing Stack:**
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing
- **MSW (Mock Service Worker)**: API mocking
- **Playwright**: E2E testing

**Test Coverage Goals:**
- Unit tests: 90%+ coverage
- Integration tests: Key user flows
- E2E tests: Critical paths

#### Test Structure
```
tests/
├── unit/
│   ├── hooks/
│   │   ├── useLineraClient.test.ts
│   │   ├── useWalletConnection.test.ts
│   │   └── useLineraApplication.test.ts
│   ├── lib/
│   │   ├── client-manager.test.ts
│   │   ├── temporary-signer.test.ts
│   │   └── metamask-signer.test.ts
│   ├── providers/
│   │   └── LineraProvider.test.tsx
│   └── utils/
│       └── logger.test.ts
├── integration/
│   ├── wallet-flow.test.tsx
│   ├── application-query.test.tsx
│   └── state-management.test.tsx
├── e2e/
│   ├── connect-wallet.spec.ts
│   ├── claim-chain.spec.ts
│   └── application-mutation.spec.ts
├── fixtures/
│   └── mock-data.ts
├── helpers/
│   └── test-utils.tsx
└── setup.ts
```

#### Example Unit Test
```typescript
// tests/unit/hooks/useLineraClient.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useLineraClient } from '@/hooks/useLineraClient';
import { LineraProvider } from '@/providers/LineraProvider';

describe('useLineraClient', () => {
  it('should initialize in read-only mode', async () => {
    const wrapper = ({ children }) => (
      <LineraProvider faucetUrl="http://localhost:8080">
        {children}
      </LineraProvider>
    );

    const { result } = renderHook(() => useLineraClient(), { wrapper });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
    });

    expect(result.current.isReadOnly).toBe(true);
    expect(result.current.canWrite).toBe(false);
  });

  // More tests...
});
```

#### Example Integration Test
```typescript
// tests/integration/wallet-flow.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LineraProvider } from '@/providers/LineraProvider';
import { useWalletConnection } from '@/hooks/useWalletConnection';

function TestComponent() {
  const { connect, isConnected, address } = useWalletConnection();

  return (
    <div>
      {isConnected ? (
        <div>Connected: {address}</div>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}

describe('Wallet Connection Flow', () => {
  it('should connect MetaMask wallet', async () => {
    // Mock MetaMask
    window.ethereum = mockMetaMask();

    render(
      <LineraProvider faucetUrl="http://localhost:8080">
        <TestComponent />
      </LineraProvider>
    );

    fireEvent.click(screen.getByText('Connect Wallet'));

    await waitFor(() => {
      expect(screen.getByText(/Connected:/)).toBeInTheDocument();
    });
  });
});
```

#### Jest Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 90,
      statements: 90,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

---

### 5. Framework-Agnostic Configuration ✅

**Challenge:**
Different frameworks require different configurations:
- Next.js: `next.config.js` with headers
- Vite: `vite.config.ts` with headers plugin
- Create React App: requires CRACO or eject
- Webpack: Custom webpack config

**Solution:**
Provide configuration helpers for each framework:

#### Next.js Configuration Helper
```typescript
// config/nextjs.ts
import type { NextConfig } from 'next';

export interface LineraNextConfig {
  /** Enable required COOP/COEP headers for SharedArrayBuffer */
  enableHeaders?: boolean;
  /** Custom header configuration */
  customHeaders?: Array<{ key: string; value: string }>;
}

export function withLinera(
  nextConfig: NextConfig = {},
  lineraConfig: LineraNextConfig = {}
): NextConfig {
  const { enableHeaders = true, customHeaders = [] } = lineraConfig;

  return {
    ...nextConfig,

    // Exclude @linera/client from server-side bundling
    serverExternalPackages: [
      ...(nextConfig.serverExternalPackages || []),
      '@linera/client',
    ],

    // Add required headers for SharedArrayBuffer
    async headers() {
      const existingHeaders = nextConfig.headers ? await nextConfig.headers() : [];

      if (!enableHeaders) {
        return existingHeaders;
      }

      const lineraHeaders = {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          ...customHeaders,
        ],
      };

      return [...existingHeaders, lineraHeaders];
    },
  };
}
```

**Usage:**
```typescript
// next.config.ts
import { withLinera } from '@linera/react-sdk/config/nextjs';

export default withLinera({
  // Your Next.js config
});
```

#### Vite Configuration Helper
```typescript
// config/vite.ts
import type { Plugin, UserConfig } from 'vite';

export interface LineraViteConfig {
  /** Enable required COOP/COEP headers for SharedArrayBuffer */
  enableHeaders?: boolean;
  /** Custom header configuration */
  customHeaders?: Record<string, string>;
}

export function lineraPlugin(config: LineraViteConfig = {}): Plugin {
  const { enableHeaders = true, customHeaders = {} } = config;

  return {
    name: 'vite-plugin-linera',
    configureServer(server) {
      if (enableHeaders) {
        server.middlewares.use((req, res, next) => {
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

          Object.entries(customHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });

          next();
        });
      }
    },
  };
}

export function withLinera(viteConfig: UserConfig = {}): UserConfig {
  return {
    ...viteConfig,
    plugins: [
      ...(viteConfig.plugins || []),
      lineraPlugin(),
    ],
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      exclude: [
        ...(viteConfig.optimizeDeps?.exclude || []),
        '@linera/client',
      ],
    },
  };
}
```

**Usage:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { lineraPlugin } from '@linera/react-sdk/config/vite';

export default defineConfig({
  plugins: [react(), lineraPlugin()],
});
```

#### Create React App (CRACO)
```typescript
// config/craco.ts
export function createLineraConfig() {
  return {
    webpack: {
      configure: (webpackConfig: any) => {
        // Add required headers via webpack-dev-server
        if (webpackConfig.devServer) {
          webpackConfig.devServer.headers = {
            ...webpackConfig.devServer.headers,
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
          };
        }

        return webpackConfig;
      },
    },
  };
}
```

**Usage:**
```javascript
// craco.config.js
const { createLineraConfig } = require('@linera/react-sdk/config/craco');

module.exports = createLineraConfig();
```

#### Generic Webpack Helper
```typescript
// config/webpack.ts
import type { Configuration } from 'webpack';

export interface LineraWebpackConfig {
  enableHeaders?: boolean;
  customHeaders?: Record<string, string>;
}

export function withLinera(
  webpackConfig: Configuration,
  config: LineraWebpackConfig = {}
): Configuration {
  const { enableHeaders = true, customHeaders = {} } = config;

  return {
    ...webpackConfig,
    devServer: {
      ...webpackConfig.devServer,
      headers: enableHeaders ? {
        ...webpackConfig.devServer?.headers,
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        ...customHeaders,
      } : webpackConfig.devServer?.headers,
    },
  };
}
```

---

### 6. Linera Assets Management ✅

**Current Approach:**
- Post-install script copies files from `node_modules/@linera/client/dist` to `public/linera/`
- Manual and framework-specific

**Enhanced Solution:**

#### Option A: Automated Post-Install with Framework Detection
```javascript
// scripts/postinstall.js
const fs = require('fs');
const path = require('path');

function detectFramework() {
  const packageJson = require(path.join(process.cwd(), 'package.json'));

  if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
    return 'nextjs';
  }
  if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
    return 'vite';
  }
  if (packageJson.dependencies?.['react-scripts']) {
    return 'cra';
  }

  return 'unknown';
}

function getPublicDir(framework) {
  switch (framework) {
    case 'nextjs':
      return 'public';
    case 'vite':
      return 'public';
    case 'cra':
      return 'public';
    default:
      return 'public';
  }
}

function copyLineraFiles() {
  const framework = detectFramework();
  const publicDir = getPublicDir(framework);
  const targetDir = path.join(process.cwd(), publicDir, 'linera');

  const sourceDir = path.join(
    process.cwd(),
    'node_modules',
    '@linera',
    'client',
    'dist'
  );

  if (!fs.existsSync(sourceDir)) {
    console.warn('[Linera SDK] Source files not found, skipping...');
    return;
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy files recursively
  copyDir(sourceDir, targetDir);

  console.log(`✓ Linera client files copied to ${publicDir}/linera/`);
}

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Run on install
try {
  copyLineraFiles();
} catch (error) {
  console.error('[Linera SDK] Error copying files:', error);
  // Don't fail install
}
```

#### Option B: Runtime Asset Serving
```typescript
// lib/linera/linera-loader.ts
export async function loadLineraModule() {
  // Dynamically determine asset path based on environment
  const assetPath = process.env.LINERA_ASSETS_PATH || '/linera';

  // Load from public directory
  const lineraModule = await import(
    /* @vite-ignore */
    /* webpackIgnore: true */
    `${assetPath}/linera-client.js`
  );

  return lineraModule;
}
```

#### Option C: Bundler Plugin (Recommended for flexibility)
```typescript
// config/vite.ts (extended)
export function lineraPlugin(config: LineraViteConfig = {}): Plugin {
  return {
    name: 'vite-plugin-linera',
    configureServer(server) {
      // Serve Linera files from node_modules directly
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/linera/')) {
          const filePath = path.join(
            process.cwd(),
            'node_modules',
            '@linera',
            'client',
            'dist',
            req.url.replace('/linera/', '')
          );

          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath);
            const ext = path.extname(filePath);
            const mimeType = getMimeType(ext);

            res.setHeader('Content-Type', mimeType);
            res.end(content);
            return;
          }
        }
        next();
      });
    },
  };
}
```

**Recommendation:**
- Keep post-install script for reliability
- Make it configurable via package.json
- Provide manual copy instructions in docs

---

## Implementation Roadmap

### Phase 1: Core Library Setup (Week 1) ✅
- [ ] Initialize npm package structure
- [ ] Set up TypeScript configuration
- [ ] Configure build system (tsup/rollup)
- [ ] Set up linting (ESLint + Prettier)
- [ ] Create basic documentation structure
- [ ] Set up repository (GitHub)

### Phase 2: Wallet Persistence (Week 1-2) ✅
- [ ] Implement `PersistentTemporarySigner`
- [ ] Implement `SessionTemporarySigner`
- [ ] Implement `EncryptedTemporarySigner`
- [ ] Update `ClientManager` to support different strategies
- [ ] Add tests for all signer implementations
- [ ] Document wallet persistence options

### Phase 3: Logging System (Week 2) ✅
- [ ] Implement `Logger` class
- [ ] Integrate logger throughout codebase
- [ ] Replace all console.* calls
- [ ] Add configuration options to provider
- [ ] Add tests for logger
- [ ] Document logging configuration

### Phase 4: Configuration Helpers (Week 2-3) ✅
- [ ] Implement Next.js helper (`withLinera`) ✅
- [ ] Implement Vite plugin ✅
- [ ] Implement CRACO configuration ✅
- [ ] Implement generic Webpack helper ✅
- [ ] Test each framework integration
- [ ] Create example projects for each framework
- [ ] Document framework-specific setup

### Phase 5: Testing Infrastructure (Week 3-4)
- [ ] Set up Jest configuration
- [ ] Set up React Testing Library
- [ ] Set up MSW for API mocking
- [ ] Write unit tests for all modules (target: 90% coverage)
- [ ] Write integration tests for user flows
- [ ] Set up Playwright for E2E tests
- [ ] Write E2E tests for critical paths
- [ ] Add test coverage reporting

### Phase 6: CI/CD & Release Automation (Week 4) ✅
- [ ] Set up GitHub Actions workflows
  - [ ] CI workflow (lint, test, build)
  - [ ] Release workflow (semantic-release)
  - [ ] Publish workflow (npm publish)
- [ ] Configure semantic-release
- [ ] Set up commitlint with husky
- [ ] Configure conventional-changelog
- [ ] Test release process on test branch
- [ ] Document contribution guidelines

### Phase 7: Documentation & Examples (Week 4-5)
- [ ] Write comprehensive README
- [ ] Create getting-started guide
- [ ] Write API reference documentation
- [ ] Create migration guide from current implementation
- [ ] Build example projects:
  - [ ] Next.js App Router example
  - [ ] Next.js Pages Router example
  - [ ] Vite + React example
  - [ ] Create React App example
- [ ] Record video tutorials (optional)
- [ ] Create Storybook for components (optional)

### Phase 8: Polish & Release (Week 5)
- [ ] Code review and refactoring
- [ ] Performance optimization
- [ ] Security audit
- [ ] Final testing across all frameworks
- [ ] Prepare changelog
- [ ] Beta release (v0.1.0-beta.1)
- [ ] Gather feedback
- [ ] Stable release (v1.0.0)

---

## API Design

### Provider Configuration
```typescript
interface LineraProviderProps {
  children: React.ReactNode;

  // Required
  faucetUrl: string;

  // Optional connection settings
  autoConnect?: boolean;
  network?: 'mainnet' | 'testnet' | 'localnet';
  skipProcessInbox?: boolean;

  // Wallet persistence
  temporarySignerStrategy?: 'persistent' | 'session' | 'ephemeral' | 'encrypted';
  temporarySignerOptions?: {
    storageKey?: string;
    encryptionPassword?: string;
  };

  // Logging
  logging?: boolean | {
    enabled?: boolean;
    level?: LogLevel;
    prefix?: string;
    customLogger?: CustomLogger;
  };

  // Error handling
  onError?: (error: Error) => void;

  // Custom UI components
  loadingComponent?: React.ReactNode;
  errorComponent?: (error: Error, retry: () => void) => React.ReactNode;
}
```

### Usage Example
```typescript
// app/layout.tsx
import { LineraProvider } from '@linera/react-sdk';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <LineraProvider
          faucetUrl="http://localhost:8080"
          network="testnet"
          temporarySignerStrategy="persistent"
          logging={{
            enabled: process.env.NODE_ENV !== 'production',
            level: LogLevel.INFO,
          }}
        >
          {children}
        </LineraProvider>
      </body>
    </html>
  );
}
```

---

## Package.json Configuration

```json
{
  "name": "@linera/react-sdk",
  "version": "1.0.0",
  "description": "Official React SDK for Linera blockchain",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./config/nextjs": {
      "types": "./dist/config/nextjs.d.ts",
      "import": "./dist/config/nextjs.mjs",
      "require": "./dist/config/nextjs.js"
    },
    "./config/vite": {
      "types": "./dist/config/vite.d.ts",
      "import": "./dist/config/vite.mjs",
      "require": "./dist/config/vite.js"
    },
    "./config/craco": {
      "types": "./dist/config/craco.d.ts",
      "import": "./dist/config/craco.mjs",
      "require": "./dist/config/craco.js"
    },
    "./config/webpack": {
      "types": "./dist/config/webpack.d.ts",
      "import": "./dist/config/webpack.mjs",
      "require": "./dist/config/webpack.js"
    }
  },
  "files": [
    "dist",
    "scripts",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit",
    "prepare": "husky install",
    "prepublishOnly": "npm run build",
    "semantic-release": "semantic-release"
  },
  "keywords": [
    "linera",
    "blockchain",
    "react",
    "web3",
    "wallet",
    "metamask",
    "dapp"
  ],
  "author": "Linera Protocol",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/linera-io/linera-react-sdk.git"
  },
  "bugs": {
    "url": "https://github.com/linera-io/linera-react-sdk/issues"
  },
  "homepage": "https://github.com/linera-io/linera-react-sdk#readme",
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "dependencies": {
    "@linera/client": "^0.15.5",
    "@metamask/providers": "^22.1.1",
    "ethers": "^6.15.0"
  },
  "devDependencies": {
    "@commitlint/cli": "^18.0.0",
    "@commitlint/config-conventional": "^18.0.0",
    "@semantic-release/changelog": "^6.0.3",
    "@semantic-release/git": "^10.0.1",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/react": "^14.1.2",
    "@testing-library/user-event": "^14.5.1",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.17.0",
    "@typescript-eslint/parser": "^6.17.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "husky": "^8.0.3",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "msw": "^2.0.11",
    "prettier": "^3.1.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "semantic-release": "^22.0.12",
    "ts-jest": "^29.1.1",
    "tsup": "^8.0.1",
    "typescript": "^5.3.3"
  }
}
```

---

## Build Configuration (tsup.config.ts)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'config/nextjs': 'src/config/nextjs.ts',
    'config/vite': 'src/config/vite.ts',
    'config/craco': 'src/config/craco.ts',
    'config/webpack': 'src/config/webpack.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@linera/client', 'ethers'],
  treeshake: true,
  minify: false, // Let consumers decide on minification
});
```

---

## Success Metrics

### Code Quality
- [ ] 90%+ test coverage
- [ ] Zero critical security vulnerabilities
- [ ] TypeScript strict mode enabled
- [ ] ESLint with zero errors
- [ ] All exports properly typed

### Performance
- [ ] Bundle size < 50KB (gzipped)
- [ ] Tree-shakeable exports
- [ ] No unnecessary re-renders
- [ ] Optimized WASM loading

### Developer Experience
- [ ] Clear error messages
- [ ] Comprehensive TypeScript types
- [ ] IntelliSense support
- [ ] Example projects for each framework
- [ ] Migration guide from current implementation

### Release Automation
- [ ] Automated versioning based on commits
- [ ] Automatic changelog generation
- [ ] CI/CD pipeline (lint, test, build, publish)
- [ ] Automatic npm publishing on release
- [ ] GitHub releases with release notes

---

## Migration Guide (for existing users)

### Before (Current Implementation)
```typescript
// app/layout.tsx
import { LineraProvider } from '@/components/providers/linera-provider';

<LineraProvider faucetUrl="http://localhost:8080">
  {children}
</LineraProvider>
```

### After (New Library)
```typescript
// app/layout.tsx
import { LineraProvider } from '@linera/react-sdk';

<LineraProvider
  faucetUrl="http://localhost:8080"
  temporarySignerStrategy="persistent"
  logging={process.env.NODE_ENV !== 'production'}
>
  {children}
</LineraProvider>
```

### Configuration Changes

**Before (next.config.ts):**
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  serverExternalPackages: ['@linera/client'],
};
```

**After:**
```typescript
import { withLinera } from '@linera/react-sdk/config/nextjs';

export default withLinera({
  // Your Next.js config
});
```

---

## Open Questions & Decisions Needed

1. **Package Naming:**
   - Option A: `@linera/react-sdk` (official, scoped)
   - Option B: `linera-react-sdk` (simpler, no scope)
   - **Recommendation:** `@linera/react-sdk` (if Linera team owns the scope)

2. **Wallet Persistence Default:**
   - Should persistent storage be opt-in or opt-out?
   - **Recommendation:** Default to `persistent` with clear warnings

3. **Asset Management:**
   - Post-install script vs runtime serving vs bundler plugin?
   - **Recommendation:** Keep post-install for reliability, document alternatives

4. **Breaking Changes:**
   - Should we maintain backward compatibility with current API?
   - **Recommendation:** Clean break with v1.0.0, provide migration guide

5. **Framework Support Priority:**
   - Which frameworks to support first?
   - **Recommendation:** Next.js → Vite → CRA (based on popularity)

6. **License:**
   - MIT vs Apache 2.0?
   - **Recommendation:** MIT (more permissive, widely adopted)

---

## Additional Resources

### Useful Libraries
- `tsup`: Fast TypeScript bundler
- `changesets`: Alternative to semantic-release
- `size-limit`: Control bundle size
- `publint`: Validate package exports
- `arethetypeswrong`: Check TypeScript types

### Documentation Tools
- `Docusaurus`: Documentation website
- `TypeDoc`: Generate API docs from TypeScript
- `Storybook`: Component documentation

### Monitoring
- `bundle-analyzer`: Analyze bundle size
- `lighthouse-ci`: Performance monitoring
- `Sentry`: Error tracking (optional)

---

## Conclusion

This enhancement plan transforms the Linera client integration into a production-ready, framework-agnostic React SDK with:

✅ Persistent wallet management
✅ Configurable logging system
✅ Automated versioning and releases
✅ Comprehensive test coverage
✅ Multi-framework support
✅ Modern developer experience

**Estimated Timeline:** 5 weeks
**Team Size:** 2-3 developers
**Priority:** High (enables wider adoption)

---

## Next Steps

1. Review and approve this plan
2. Create GitHub repository
3. Set up initial project structure
4. Begin Phase 1 implementation
5. Regular progress reviews (weekly)

**Questions or feedback?** Open an issue or start a discussion!
