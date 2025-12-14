/**
 * WASM Environment Validator
 *
 * Validates browser environment before WASM initialization
 * to provide clear error messages and prevent cryptic runtime errors.
 */

export interface WasmEnvironmentCheck {
  /** Whether the environment supports all required features */
  supported: boolean;
  /** List of missing critical features */
  missingFeatures: string[];
  /** List of non-critical warnings */
  warnings: string[];
}

/**
 * Validates that the browser environment supports WASM requirements
 *
 * Checks for:
 * - SharedArrayBuffer support (required for multi-threading)
 * - WebAssembly support
 * - Web Workers support
 * - Cross-origin isolation (COOP/COEP headers)
 *
 * @returns Object with validation results
 *
 * @example
 * ```ts
 * const check = validateWasmEnvironment();
 * if (!check.supported) {
 *   console.error('Missing features:', check.missingFeatures);
 * }
 * if (check.warnings.length > 0) {
 *   console.warn('Warnings:', check.warnings);
 * }
 * ```
 */
export function validateWasmEnvironment(): WasmEnvironmentCheck {
  const missingFeatures: string[] = [];
  const warnings: string[] = [];

  // Check SharedArrayBuffer support
  if (typeof SharedArrayBuffer === 'undefined') {
    missingFeatures.push('SharedArrayBuffer not available');
  }

  // Check cross-origin isolation (indirect check)
  // crossOriginIsolated is only available in secure contexts
  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
    warnings.push(
      'Page is not cross-origin isolated (COOP/COEP headers may be missing). ' +
      'This is required for SharedArrayBuffer in modern browsers.'
    );
  }

  // Check WebAssembly support
  if (typeof WebAssembly === 'undefined') {
    missingFeatures.push('WebAssembly not supported');
  }

  // Check Worker support
  if (typeof Worker === 'undefined') {
    missingFeatures.push('Web Workers not supported');
  }

  return {
    supported: missingFeatures.length === 0,
    missingFeatures,
    warnings,
  };
}
