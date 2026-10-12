import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@trackroster/types': fileURLToPath(
        new URL('../../packages/types/src/index.ts', import.meta.url),
      ),
    },
  },

  test: {
    clearMocks: true,
  },
});
