import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom', // Use happy-dom for browser simulation
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'examples/',
        'scripts/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
    },
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
