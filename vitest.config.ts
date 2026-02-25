import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
