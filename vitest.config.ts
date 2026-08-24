// Workspace-wide vitest config: project-based (node for shared+api logic,
// jsdom for web component tests).
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/shared/src/**/*.ts',
        'apps/api/src/**/*.ts',
        'apps/web/src/**/*.{ts,tsx}',
      ],
    },
    projects: [
      {
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'apps/web/src'),
            '@kaizenlife/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
          },
        },
        test: {
          name: 'node',
          globals: true,
          environment: 'node',
          include: ['packages/shared/**/*.test.{ts,tsx}', 'apps/api/**/*.test.{ts,tsx}'],
        },
      },
      {
        esbuild: {
          jsx: 'automatic',
          jsxImportSource: 'react',
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'apps/web/src'),
            '@kaizenlife/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
          },
        },
        test: {
          name: 'web',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./apps/web/src/test-setup.ts'],
          include: ['apps/web/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
