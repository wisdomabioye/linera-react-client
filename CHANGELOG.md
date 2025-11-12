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
