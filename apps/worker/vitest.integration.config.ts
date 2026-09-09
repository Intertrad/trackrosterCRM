import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    include: ['test/**/*.integration.spec.ts'],

    clearMocks: true,

    fileParallelism: false,

    testTimeout: 10_000,

    hookTimeout: 15_000,
  },
});
