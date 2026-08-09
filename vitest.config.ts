// Workspace-wide vitest config: runs tests for apps/web + packages/shared.
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'out', '.astro', 'apps/api/node_modules', '**/node_modules/**/*.test.*'],
    setupFiles: ['./apps/web/src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/shared/src/**/*.ts', 'apps/web/src/**/*.tsx'],
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
      '@kaizenlife/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});