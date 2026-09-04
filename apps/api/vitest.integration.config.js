import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({
  path: '../../.env',
});

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },

  test: {
    globals: true,
    root: './',
    include: ['**/*.integration.spec.ts'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
