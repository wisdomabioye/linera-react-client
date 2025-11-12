/**
 * CRACO Configuration Helper for Linera React SDK
 *
 * Provides configuration for Create React App (CRA) using CRACO
 * to enable required COOP/COEP headers for SharedArrayBuffer support.
 *
 * @see https://github.com/dilanx/craco
 */

/**
 * Webpack DevServer configuration with headers
 */
export interface WebpackDevServerConfig {
  headers?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Webpack configuration with devServer
 */
export interface WebpackConfig {
  devServer?: WebpackDevServerConfig;
  [key: string]: unknown;
}

/**
 * CRACO webpack context
 */
export interface CracoWebpackContext {
  env: string;
  paths: Record<string, string>;
}

/**
 * CRACO configuration interface
 */
export interface CracoConfig {
  webpack?: {
    configure?: (webpackConfig: WebpackConfig, context: CracoWebpackContext) => WebpackConfig;
  };
  devServer?: (devServerConfig: WebpackDevServerConfig, context: CracoWebpackContext) => WebpackDevServerConfig;
}

/**
 * Create Linera-compatible CRACO configuration
 *
 * @example
 * ```javascript
 * // craco.config.js
 * const { createLineraConfig } = require('linera-react-client/config/craco');
 *
 * module.exports = createLineraConfig();
 * ```
 *
 * @example
 * ```javascript
 * // With custom configuration
 * const { createLineraConfig } = require('linera-react-client/config/craco');
 *
 * const lineraConfig = createLineraConfig();
 *
 * module.exports = {
 *   ...lineraConfig,
 *   // Your other CRACO config
 * };
 * ```
 */
export function createLineraConfig(): CracoConfig {
  return {
    webpack: {
      configure: (webpackConfig: WebpackConfig) => {
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
