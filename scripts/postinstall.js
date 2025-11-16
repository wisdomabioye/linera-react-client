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
 * Find the root project directory (consuming project, not this package)
 */
function findProjectRoot() {
  let currentDir = process.cwd();

  // If we're inside node_modules, traverse up to find the project root
  if (currentDir.includes('node_modules')) {
    const parts = currentDir.split(path.sep);
    const nodeModulesIndex = parts.lastIndexOf('node_modules');

    if (nodeModulesIndex > 0) {
      // Go up to the directory containing node_modules
      currentDir = parts.slice(0, nodeModulesIndex).join(path.sep);
    }
  }

  return currentDir;
}

/**
 * Detect the framework being used
 */
function detectFramework(projectRoot) {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');

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
function getUserConfig(projectRoot) {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');

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
    log('� Skipping in CI environment', 'yellow');
    log('  Run manually if needed: node node_modules/@linera/react-sdk/scripts/postinstall.js', 'gray');
    return;
  }

  // Find the project root (not node_modules)
  const projectRoot = findProjectRoot();
  log(`Project root: ${projectRoot}`, 'gray');

  // Get user configuration
  const userConfig = getUserConfig(projectRoot);

  // Check if user wants to skip postinstall
  if (userConfig.skipPostinstall === true) {
    log('� Skipped (skipPostinstall = true in package.json)', 'yellow');
    log('  To copy files manually, run: node node_modules/@linera/react-sdk/scripts/postinstall.js', 'gray');
    return;
  }

  // Detect framework
  const framework = detectFramework(projectRoot);
  log(`Framework detected: ${framework}`, 'gray');

  // Determine directories
  const publicDir = userConfig.publicDir || getPublicDir(framework);
  const targetSubDir = userConfig.targetDir || 'linera';

  // Try multiple possible locations for @linera/client
  const possibleSourceDirs = [
    // In consuming project's node_modules (when installed as package)
    path.join(projectRoot, 'node_modules', '@linera', 'client', 'dist'),
    // In sibling node_modules (when using npm workspaces or pnpm)
    path.join(__dirname, '..', '..', '@linera', 'client', 'dist'),
    // In parent's node_modules (for monorepos)
    path.join(__dirname, '..', '..', '..', '@linera', 'client', 'dist'),
  ];

  const sourceDir = possibleSourceDirs.find(dir => fs.existsSync(dir)) || possibleSourceDirs[0];
  const targetDir = path.join(projectRoot, publicDir, targetSubDir);

  log(`Source: ${path.relative(projectRoot, sourceDir)}`, 'gray');
  log(`Target: ${path.relative(projectRoot, targetDir)}`, 'gray');
  log('', 'reset');

  try {
    // Check if source exists
    if (!fs.existsSync(sourceDir)) {
      log('� Source files not found', 'yellow');
      log('  This is expected if @linera/client is not yet installed', 'gray');
      log('  Files will be copied after @linera/client is installed', 'gray');
      return;
    }

    // Copy files
    log('Copying Linera assets...', 'cyan');
    const fileCount = copyDir(sourceDir, targetDir);

    log(` Successfully copied ${fileCount} files to ${path.relative(projectRoot, targetDir)}`, 'green');
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
