import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: { resolve: true },
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ['react', 'react-dom', '@linera/client', 'next', 'ethers', 'vite'],
  treeshake: true,
  minify: true,
  banner: {
    js: '"use client";',
  },
});
