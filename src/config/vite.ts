/**
 * Vite Configuration Helper for Linera React SDK
 *
 * Provides a Vite plugin and configuration helper that sets up the required
 * environment for Linera client (COOP/COEP headers, external packages, etc.)
 */

import type { Plugin, UserConfig, ViteDevServer, PreviewServer, Connect } from 'vite';
import type { ServerResponse } from 'http';

/**
 * Configuration options for Linera Vite plugin
 */
export interface LineraViteConfig {
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
 * Create a Vite plugin that configures Linera requirements
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'vite';
 * import react from '@vitejs/plugin-react';
 * import { lineraPlugin } from 'linera-react-client/config/vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     react(),
 *     lineraPlugin(),
 *   ],
 * });
 * ```
 */
export function lineraPlugin(options: LineraViteConfig = {}): Plugin {
  const {
    enableHeaders = true,
    customHeaders = {},
  } = options;

  return {
    name: 'vite-plugin-linera',

    // Configure dev server with required headers
    configureServer(server: ViteDevServer) {
      if (enableHeaders) {
        server.middlewares.use((req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
          // Set required headers for SharedArrayBuffer support
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

          // Set custom headers
          Object.entries(customHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });

          next();
        });
      }
    },

    // Configure preview server with required headers
    configurePreviewServer(server: PreviewServer) {
      if (enableHeaders) {
        server.middlewares.use((req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
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

/**
 * Complete Vite configuration helper with all Linera requirements
 *
 * This is a convenience function that applies all necessary Vite configurations
 * for Linera in one go.
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'vite';
 * import react from '@vitejs/plugin-react';
 * import { withLinera } from 'linera-react-client/config/vite';
 *
 * export default defineConfig(
 *   withLinera({
 *     plugins: [react()],
 *     // Your other Vite config
 *   })
 * );
 * ```
 */
export function withLinera(
  viteConfig: UserConfig = {},
  lineraConfig: LineraViteConfig = {}
): UserConfig {
  const existingPlugins = viteConfig.plugins || [];
  const plugins = Array.isArray(existingPlugins) ? existingPlugins : [existingPlugins];

  return {
    ...viteConfig,

    // Add Linera plugin
    plugins: [
      ...plugins,
      lineraPlugin(lineraConfig),
    ],

    // Configure build
    build: {
      ...viteConfig.build,
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        external: [
          ...(Array.isArray(viteConfig.build?.rollupOptions?.external)
            ? viteConfig.build.rollupOptions.external
            : viteConfig.build?.rollupOptions?.external
            ? [viteConfig.build.rollupOptions.external as string]
            : []),
          '@linera/client',
        ] as string[],
      },
    },

    // Configure esbuild
    esbuild: viteConfig.esbuild === false ? false : {
      ...(typeof viteConfig.esbuild === 'object' ? viteConfig.esbuild : {}),
      supported: {
        ...(typeof viteConfig.esbuild === 'object' ? viteConfig.esbuild.supported : {}),
        'top-level-await': true,
      },
    },

    // Configure optimizeDeps
    optimizeDeps: {
      ...viteConfig.optimizeDeps,
      exclude: [
        ...(viteConfig.optimizeDeps?.exclude || []),
        '@linera/client',
      ],
    },
  };
}

