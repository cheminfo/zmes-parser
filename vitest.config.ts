import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    snapshotFormat: {
      maxOutputLength: 1e8,
    },
    coverage: {
      exclude: ['src/__tests__/**'],
      include: ['src/**/*.ts'],
      provider: 'v8',
    },
    setupFiles: [
      // 'vitest.setup.ts',
    ],
  },
});
