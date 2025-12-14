/**
 * Linera Client Loader
 *
 * This module dynamically loads the Linera client from the public directory
 * using a technique that works with Next.js/Turbopack.
 */

import type { LineraModule } from './linera-types';
import { logger } from '../../utils/logger';

/**
 * Load the Linera WebAssembly module from the public directory
 *
 * @returns Promise resolving to the Linera module with typed exports
 *
 * @example
 * ```ts
 * const { Client, Faucet, default: init } = await loadLineraModule();
 * await init(); // Initialize WASM
 * const faucet = new Faucet('http://localhost:8080');
 * ```
 */
export async function loadLineraModule(): Promise<LineraModule> {
  // Use dynamic import with the origin to load from public directory
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const moduleUrl = `${origin}/linera/linera.js`;

  logger.info('Loading Linera module from:', moduleUrl);

  // Load the module using dynamic import with URL
  const lineraModule = await import(/* @vite-ignore */ /* webpackIgnore: true */ moduleUrl) as LineraModule;

  logger.info('Linera module loaded:', lineraModule);

  return lineraModule;
}
