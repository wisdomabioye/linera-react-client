/**
 * WASM Error Handler
 *
 * Provides error boundaries and recovery for WASM operations.
 * Classifies errors and provides actionable error messages.
 */

import { logger } from '../../utils/logger';

/**
 * WASM-specific error codes
 */
export enum WasmErrorCode {
  /** Memory access out of bounds error */
  MEMORY_OUT_OF_BOUNDS = 'MEMORY_OUT_OF_BOUNDS',
  /** WASM module initialization failed */
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  /** SharedArrayBuffer not available */
  SHARED_ARRAY_BUFFER_UNAVAILABLE = 'SHARED_ARRAY_BUFFER_UNAVAILABLE',
  /** Unknown or unclassified error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for WASM-specific errors
 */
export class WasmError extends Error {
  constructor(
    message: string,
    public readonly code: WasmErrorCode,
    public readonly recoverable: boolean,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'WasmError';

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WasmError);
    }
  }
}

/**
 * Classifies an error as a specific WASM error type
 *
 * @param error - The error to classify
 * @returns Classified WasmError with additional context
 *
 * @example
 * ```ts
 * try {
 *   await init();
 * } catch (error) {
 *   const wasmError = classifyWasmError(error);
 *   console.error('WASM error:', wasmError.code, wasmError.message);
 * }
 * ```
 */
export function classifyWasmError(error: unknown): WasmError {
  const message = error instanceof Error ? error.message : String(error);
  const originalError = error instanceof Error ? error : undefined;

  // Memory out of bounds patterns
  if (
    message.includes('memory access out of bounds') ||
    message.includes('out of bounds memory access')
  ) {
    return new WasmError(
      'WASM memory access violation. This may be due to incorrect Vite configuration. ' +
      'Ensure you are using withLinera() or lineraPlugin() from linera-react-client/config/vite.',
      WasmErrorCode.MEMORY_OUT_OF_BOUNDS,
      true, // recoverable via reinit
      originalError
    );
  }

  // SharedArrayBuffer availability
  if (
    message.includes('SharedArrayBuffer') ||
    message.includes('shared memory')
  ) {
    return new WasmError(
      'SharedArrayBuffer not available. Ensure COOP/COEP headers are set correctly. ' +
      'Headers required: Cross-Origin-Embedder-Policy: require-corp, Cross-Origin-Opener-Policy: same-origin',
      WasmErrorCode.SHARED_ARRAY_BUFFER_UNAVAILABLE,
      false, // not recoverable - requires server config
      originalError
    );
  }

  // Initialization failures
  if (
    message.includes('init') ||
    message.includes('initialization') ||
    message.includes('WebAssembly')
  ) {
    return new WasmError(
      'WASM initialization failed. Check that linera.js and linera_bg.wasm are accessible from /linera/ path.',
      WasmErrorCode.INITIALIZATION_FAILED,
      true, // recoverable via retry
      originalError
    );
  }

  // Unknown error
  return new WasmError(
    message || 'Unknown WASM error occurred',
    WasmErrorCode.UNKNOWN,
    false,
    originalError
  );
}

/**
 * Executes an operation with WASM error boundary
 *
 * Wraps async operations to catch and classify WASM-specific errors,
 * providing better error messages and logging.
 *
 * @param operation - The async operation to execute
 * @param context - Human-readable context for the operation (for logging)
 * @returns Result of the operation
 * @throws {WasmError} Classified WASM error with additional context
 *
 * @example
 * ```ts
 * const result = await executeWithWasmErrorBoundary(
 *   () => myWasmOperation(),
 *   'Loading WASM module'
 * );
 * ```
 */
export async function executeWithWasmErrorBoundary<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const wasmError = classifyWasmError(error);
    logger.error(`[WasmErrorBoundary] ${context}:`, {
      code: wasmError.code,
      message: wasmError.message,
      recoverable: wasmError.recoverable,
      originalError: wasmError.originalError,
    });
    throw wasmError;
  }
}
