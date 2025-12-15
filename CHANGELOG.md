## [1.2.10](https://github.com/wisdomabioye/linera-react-client/compare/v1.2.9...v1.2.10) (2025-12-15)


### Bug Fixes

* bug in walletClient query ([6544275](https://github.com/wisdomabioye/linera-react-client/commit/65442757ead216bfb52ec06a4e2a658d56bfdd39))
* release config ([2373b70](https://github.com/wisdomabioye/linera-react-client/commit/2373b70d4e18460f2169c4e8b2571f733163de2a))
* release config ([726dc99](https://github.com/wisdomabioye/linera-react-client/commit/726dc99c94f2198c10b39be37b428473c251c667))
* update release config ([9cc9924](https://github.com/wisdomabioye/linera-react-client/commit/9cc99245f3d82321b3ef46667155fb94cfaf1206))

## [1.2.1](https://github.com/wisdomabioye/linera-react-client/compare/v1.2.0...v1.2.1) (2025-12-15)


### Bug Fixes

* walletClient query call failure ([d9d688a](https://github.com/wisdomabioye/linera-react-client/commit/d9d688a55e5695a13b6d94fe51428e0e65532db5))

# [1.2.0](https://github.com/wisdomabioye/linera-react-client/compare/v1.1.0...v1.2.0) (2025-12-01)


### Features

* add public address and chain ID retrieval methods to ApplicationClient ([bcdc3a9](https://github.com/wisdomabioye/linera-react-client/commit/bcdc3a93cdfc51c3d09501911848c4f7f2e4147c))
* add reinit method to LineraClientManager for robust client recovery ([90ae3c6](https://github.com/wisdomabioye/linera-react-client/commit/90ae3c6f69f0d61c8624b0ad8b14075601787d25))
* enhance WalletClient interface with query methods for improved cross-chain operations ([b592db7](https://github.com/wisdomabioye/linera-react-client/commit/b592db78106370e5a34d28a2a5efd783b3b01ca4))
* implement dual-chain architecture for improved query and mutation handling ([4db10af](https://github.com/wisdomabioye/linera-react-client/commit/4db10afdf94da62d2c8baeaa718c079ad28066db))

# [1.1.0](https://github.com/wisdomabioye/linera-react-client/compare/v1.0.2...v1.1.0) (2025-11-16)


### Features

* enhance Linera client setup with improved error handling and dynamic module loading ([1b1c5a3](https://github.com/wisdomabioye/linera-react-client/commit/1b1c5a340d155c5e3ad929b24ec2d812f3dfb066))

## [1.0.2](https://github.com/wisdomabioye/linera-react-client/compare/v1.0.1...v1.0.2) (2025-11-13)


### Bug Fixes

* improve Linera module loading with dynamic import from public directory ([0be5ba3](https://github.com/wisdomabioye/linera-react-client/commit/0be5ba36d231866e50ebfb9b2f79b3d34191e43a))

## [1.0.1](https://github.com/wisdomabioye/linera-react-client/compare/v1.0.0...v1.0.1) (2025-11-13)


### Bug Fixes

* reduce package size by 70% ([caabb4e](https://github.com/wisdomabioye/linera-react-client/commit/caabb4e70e616dd33a95c754ee5450776c84dce2))

# 1.0.0 (2025-11-13)


### Bug Fixes

* update Node.js version to 22.x in release workflow ([438b498](https://github.com/wisdomabioye/linera-react-client/commit/438b498af1351f2f5d8ecd44be530f29a209d035))
* use NPM_TOKEN environment variable for semantic-release ([88a4435](https://github.com/wisdomabioye/linera-react-client/commit/88a4435f4107fb7bc33955f4bda29d601c6b2868))


### Features

* first commit ([4fa483d](https://github.com/wisdomabioye/linera-react-client/commit/4fa483dbcb6c4cf070f49ff065fd1fa91a54398f))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Configurable Logging System**: Logger with multiple log levels (NONE, ERROR, WARN, INFO, DEBUG)
  - Custom logger support for integration with services like Sentry
  - Environment-aware defaults
  - Type-safe implementation with generics
  - Ergonomic proxy-based logger export
- **Linera Assets Management**: Automated postinstall script for reliable asset copying
  - Framework detection (Next.js, Vite, CRA)
  - CI environment detection
  - User configuration support via package.json
  - Graceful error handling
- **Vite Configuration Helper**: Complete Vite support matching Next.js approach
  - `lineraPlugin()` for Vite plugin approach
  - `withLinera()` for complete config helper
  - COOP/COEP headers for SharedArrayBuffer support
  - Proper external package handling
- **Automated Versioning and Release**: Semantic-release integration
  - Commitlint for conventional commits validation
  - Husky git hooks (pre-commit, commit-msg)
  - GitHub Actions CI/CD workflows
  - Automated changelog generation
  - Automated npm publishing

### Changed
- Replaced all console calls throughout the codebase with configurable logger
- Updated README with comprehensive documentation for Vite, logging, and asset management
- Enhanced TypeScript type safety (removed all `any` types in favor of generics)

### Fixed
- Template literal syntax errors in logger implementation
- Type safety improvements throughout the codebase

## [0.1.0] - 2025-11-12

### Added

#### 🚀 Read-Only Wallet Configuration (Major Performance Enhancement)
- **Constant Address Mode**: Use a single constant wallet address for all read-only users
  - Zero overhead - no wallet creation
  - Same chain for all users - faucet can cache
  - Recommended for production deployments
- **Storage Persistence**: Optional localStorage/sessionStorage support
  - Wallet survives page reloads
  - User maintains consistent read-only identity
- **Ephemeral Mode**: Default behavior (backward compatible)
  - New random wallet each reload
  - Maximum privacy

#### Configuration Priority
1. `constantAddress` (Highest - most efficient)
2. `storage` (Medium - user persistence)
3. Ephemeral random (Fallback - privacy)

### Enhanced

- **LineraProvider** now accepts `readOnlyWallet` configuration
- **TemporarySigner** supports multiple initialization strategies
- **ClientConfig** includes comprehensive wallet configuration options
- Updated TypeScript types with full documentation

### Example Usage

```typescript
// Recommended: Constant address (most efficient)
<LineraProvider
  faucetUrl="http://localhost:8080"
  readOnlyWallet={{
    constantAddress: "0x0000000000000000000000000000000000000000"
  }}
>
  {children}
</LineraProvider>

// Alternative: localStorage persistence
<LineraProvider
  faucetUrl="http://localhost:8080"
  readOnlyWallet={{ storage: 'localStorage' }}
>
  {children}
</LineraProvider>

// Default: Ephemeral (backward compatible)
<LineraProvider faucetUrl="http://localhost:8080">
  {children}
</LineraProvider>
```

### Benefits

- ⚡ **50-100x faster** initialization for read-only users (with constant address)
- 💾 **Zero storage overhead** when using constant address
- 🔄 **Backward compatible** - no breaking changes
- 📦 **Small bundle size** - 24KB (unminified)
- 🎯 **Production-ready** optimization

## [0.0.1] - Initial Release

- Core Linera client integration
- React hooks: `useLineraClient`, `useWalletConnection`, `useApplication`
- `LineraProvider` for easy setup
- MetaMask wallet support
- TypeScript support
- Next.js configuration helper
