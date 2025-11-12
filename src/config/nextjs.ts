/**
 * Next.js Configuration Helper for Linera
 *
 * Provides easy configuration for Next.js apps using Linera
 */

import type { NextConfig } from 'next';

export interface LineraNextConfig {
  /** Enable required COOP/COEP headers for SharedArrayBuffer */
  enableHeaders?: boolean;
  /** Custom header configuration */
  customHeaders?: Array<{ key: string; value: string }>;
}

/**
 * Wrap your Next.js config with Linera-specific settings
 *
 * @example
 * ```typescript
 * import { withLinera } from 'linera-react-client/config/nextjs';
 *
 * export default withLinera({
 *   // Your Next.js config
 * });
 * ```
 */
export function withLinera(
  nextConfig: NextConfig = {},
  lineraConfig: LineraNextConfig = {}
): NextConfig {
  const { enableHeaders = true, customHeaders = [] } = lineraConfig;

  return {
    ...nextConfig,

    // Exclude @linera/client from server-side bundling
    serverExternalPackages: [
      ...(nextConfig.serverExternalPackages || []),
      '@linera/client',
    ],

    // Add required headers for SharedArrayBuffer (needed by Linera WASM)
    async headers() {
      const existingHeaders = nextConfig.headers ? await nextConfig.headers() : [];

      if (!enableHeaders) {
        return existingHeaders;
      }

      const lineraHeaders = {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          ...customHeaders,
        ],
      };

      return [...existingHeaders, lineraHeaders];
    },
  };
}
