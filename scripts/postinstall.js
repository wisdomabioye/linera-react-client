#!/usr/bin/env node

/**
 * Post-install script for @linera/react-sdk
 *
 * Automatically copies Linera WASM and worker files to the consuming project's
 * public directory. This is required because these files must be served as
 * static assets.
 *
 * Features:
 * - Automatic framework detection (Next.js, Vite, CRA)
 * - Configurable via package.json
 * - Graceful error handling
 * - Skip in CI environments
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if running in CI environment
 */
function isCI() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  );
}

/**
 * Detect the framework being used
 */
function detectFramework() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return 'unknown';
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.next) return 'nextjs';
    if (deps.vite) return 'vite';
    if (deps['react-scripts']) return 'cra';

    return 'unknown';
  } catch (error) {
    log(`Warning: Failed to detect framework: ${error.message}`, 'yellow');
    return 'unknown';
  }
}

/**
 * Get the public directory path based on framework
 */
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

/**
 * Check if user has configured custom settings in package.json
 */
function getUserConfig() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return {};
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.lineraConfig || {};
  } catch (error) {
    return {};
  }
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Source directory not found: ${src}`);
  }

  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  let fileCount = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      fileCount += copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
    }
  }

  return fileCount;
}

/**
 * Main execution
 */
function main() {
  log('\n[Linera React SDK] Post-install setup', 'cyan');
  log(''.repeat(50), 'gray');

  // Skip in CI environments by default
  if (isCI()) {
    log('˜ Skipping in CI environment', 'yellow');
    log('  Run manually if needed: node node_modules/@linera/react-sdk/scripts/postinstall.js', 'gray');
    return;
  }

  // Get user configuration
  const userConfig = getUserConfig();

  // Check if user wants to skip postinstall
  if (userConfig.skipPostinstall === true) {
    log('˜ Skipped (skipPostinstall = true in package.json)', 'yellow');
    log('  To copy files manually, run: node node_modules/@linera/react-sdk/scripts/postinstall.js', 'gray');
    return;
  }

  // Detect framework
  const framework = detectFramework();
  log(`Framework detected: ${framework}`, 'gray');

  // Determine directories
  const publicDir = userConfig.publicDir || getPublicDir(framework);
  const targetSubDir = userConfig.targetDir || 'linera';

  const sourceDir = path.join(__dirname, '..', 'node_modules', '@linera', 'client', 'dist');
  const targetDir = path.join(process.cwd(), publicDir, targetSubDir);

  log(`Source: ${path.relative(process.cwd(), sourceDir)}`, 'gray');
  log(`Target: ${path.relative(process.cwd(), targetDir)}`, 'gray');
  log('', 'reset');

  try {
    // Check if source exists
    if (!fs.existsSync(sourceDir)) {
      log('  Source files not found', 'yellow');
      log('  This is expected if @linera/client is not yet installed', 'gray');
      log('  Files will be copied after @linera/client is installed', 'gray');
      return;
    }

    // Copy files
    log('Copying Linera assets...', 'cyan');
    const fileCount = copyDir(sourceDir, targetDir);

    log(` Successfully copied ${fileCount} files to ${path.relative(process.cwd(), targetDir)}`, 'green');
    log('', 'reset');
    log('Next steps:', 'cyan');
    log('  1. Ensure your bundler serves files from the public directory', 'gray');
    log('  2. Configure required headers (see documentation)', 'gray');
    log('', 'reset');

  } catch (error) {
    log(' Failed to copy Linera assets', 'red');
    log(`  Error: ${error.message}`, 'gray');
    log('', 'reset');
    log('Manual copy instructions:', 'yellow');
    log(`  1. Copy from: ${sourceDir}`, 'gray');
    log(`  2. Copy to: ${targetDir}`, 'gray');
    log('  3. Or run: npm run linera:copy', 'gray');
    log('', 'reset');

    // Don't exit with error - allow installation to continue
    // Users can copy manually if needed
  }
}

// Only run if this script is executed directly (not required as module)
if (require.main === module) {
  main();
}

module.exports = { copyDir, detectFramework, getPublicDir };
