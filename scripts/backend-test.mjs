import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

// These credentials address only docker-compose.backend-test.yml. Never load or
// migrate the developer's ordinary DATABASE_URL through this runner.
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? 'integration';
const filters = process.argv.slice(3);
const env = {
  ...process.env,
  // Integration suites explicitly drain action effects for deterministic assertions.
  ACTION_EFFECTS_POLLING: 'off',
  DATA_JOBS_POLLING: 'off',
  RESERVATION_RECONCILIATION: 'off',
  DATABASE_URL:
    'postgresql://backend_test:local-backend-test-only@127.0.0.1:55439/trackroster_backend_test',
  MAILPIT_URL: 'http://127.0.0.1:58025',
  AUTH_PUBLIC_ORIGIN: 'http://localhost:3000',
  MFA_ENCRYPTION_KEY: '11'.repeat(32),
  SSO_ENCRYPTION_KEY: '22'.repeat(32),
  REDIS_URL: 'redis://127.0.0.1:56389',
  JWT_ACCESS_SECRET: 'isolated-backend-access-secret-at-least-32-characters',
  JWT_REFRESH_SECRET: 'isolated-backend-refresh-secret-at-least-32-characters',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  PROSPECT_COOLING_OFF_MINUTES: '60',
  // The functional suites share one loopback IP; limiter-specific tests use their own low limits.
  AUTH_RATE_LIMIT_IP: '100000',
  AUTH_RATE_LIMIT_ACCOUNT: '100000',
};

function run(app, executable, args) {
  const result = spawnSync(`${root}apps/${app}/node_modules/.bin/${executable}`, args, {
    cwd: `${root}apps/${app}`,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (mode === 'migrate') {
  process.exitCode = run('api', 'drizzle-kit', ['migrate', '--config=drizzle.config.ts']);
} else if (mode === 'api' || mode === 'worker') {
  process.exitCode = run(mode, 'vitest', [
    'run',
    '--config=vitest.integration.config.ts',
    ...filters,
  ]);
} else if (mode === 'integration') {
  const apiStatus = run('api', 'vitest', ['run', '--config=vitest.integration.config.ts']);
  const workerStatus = run('worker', 'vitest', ['run', '--config=vitest.integration.config.ts']);
  process.exitCode = apiStatus || workerStatus;
} else {
  throw new Error('Use migrate, api, worker, or integration');
}
