import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'config/nextjs': 'src/config/nextjs.ts',
    'config/vite': 'src/config/vite.ts',
    'config/craco': 'src/config/craco.ts',
    'config/webpack': 'src/config/webpack.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@linera/client', 'ethers', 'vite'],
  treeshake: true,
  minify: false,
});
