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

    /*
     * The Supabase session pool is shared by every Nest application created by
     * these suites. Running dozens of files concurrently exhausts its client
     * cap and turns otherwise independent tests into EMAXCONNSESSION failures.
     * Keep the integration gate deterministic and below the provider limit.
     */
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,

    /*
     * The authentication limiter keys on IP plus identity, and every suite
     * signs in from 127.0.0.1 against one Redis. At the production default of
     * 60 logins per minute the suites exhaust a single shared bucket, so
     * whichever ones run later fail with 429 regardless of the code under
     * test — which is how a healthy suite came to be read as a broken one.
     *
     * Raising the ceiling here does not weaken any coverage: the test that
     * actually exercises the limiter builds its own ConfigService with a
     * limit of 1 and a synthetic IP, so it is unaffected by these values.
     */
    env: {
      AUTH_RATE_LIMIT_IP: '1000000',
      AUTH_RATE_LIMIT_ACCOUNT: '1000000',

      /*
       * Storing an OIDC client secret needs a 32-byte key, and without one the
       * endpoint correctly answers 503 rather than persisting the secret in
       * clear. That is the right behaviour, but it meant the OIDC coverage
       * depended on whether the developer happened to have this set locally, so
       * the suite provides its own. A fixed value keeps the encrypt/decrypt
       * assertions deterministic; it is a test key and protects nothing.
       */
      SSO_ENCRYPTION_KEY: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    },
  },
});
