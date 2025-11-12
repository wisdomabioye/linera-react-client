/**
 * Webpack Configuration Helper for Linera React SDK
 *
 * Provides a generic Webpack configuration helper that sets up the required
 * COOP/COEP headers for SharedArrayBuffer support in development servers.
 */

/**
 * Webpack Configuration type
 */
export interface WebpackConfiguration {
  devServer?: {
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Configuration options for Linera Webpack helper
 */
export interface LineraWebpackConfig {
  /**
   * Enable required COOP/COEP headers for SharedArrayBuffer
   * @default true
   */
  enableHeaders?: boolean;

  /**
   * Custom headers to add
   * @default {}
   */
  customHeaders?: Record<string, string>;
}

/**
 * Enhance Webpack configuration with Linera requirements
 *
 * @example
 * ```typescript
 * // webpack.config.js
 * const { withLinera } = require('linera-react-client/config/webpack');
 *
 * module.exports = withLinera({
 *   // Your webpack config
 *   entry: './src/index.js',
 *   // ...
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom headers
 * const { withLinera } = require('linera-react-client/config/webpack');
 *
 * module.exports = withLinera(
 *   {
 *     entry: './src/index.js',
 *     // ...
 *   },
 *   {
 *     enableHeaders: true,
 *     customHeaders: {
 *       'X-Custom-Header': 'value'
 *     }
 *   }
 * );
 * ```
 */
export function withLinera(
  webpackConfig: WebpackConfiguration,
  config: LineraWebpackConfig = {}
): WebpackConfiguration {
  const { enableHeaders = true, customHeaders = {} } = config;

  return {
    ...webpackConfig,
    devServer: {
      ...webpackConfig.devServer,
      headers: enableHeaders
        ? {
            ...webpackConfig.devServer?.headers,
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
            ...customHeaders,
          }
        : webpackConfig.devServer?.headers,
    },
  };
}
