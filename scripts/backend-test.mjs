import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { Client } = require('../apps/api/node_modules/pg');

// These credentials address only docker-compose.backend-test.yml. Never load or
// migrate the developer's ordinary DATABASE_URL through this runner.
const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2] ?? 'integration';
const filters = process.argv.slice(3);
const runtimeDatabaseUrl =
  'postgresql://trackroster_app:trackroster_app@127.0.0.1:55439/trackroster_backend_test?sslmode=disable';
const seedDatabaseUrl =
  'postgresql://backend_test:local-backend-test-only@127.0.0.1:55439/trackroster_backend_test?sslmode=disable';
const env = {
  ...process.env,
  // Integration suites explicitly drain action effects for deterministic assertions.
  ACTION_EFFECTS_POLLING: 'off',
  DATA_JOBS_POLLING: 'off',
  RESERVATION_RECONCILIATION: 'off',
  DATABASE_URL: runtimeDatabaseUrl,
  DATABASE_SEED_URL: seedDatabaseUrl,
  DATABASE_MIGRATION_URL: seedDatabaseUrl,
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

async function provisionRuntimeRole({ grantObjects = false } = {}) {
  const client = new Client({ connectionString: seedDatabaseUrl });

  await client.connect();

  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trackroster_app') THEN
          CREATE ROLE trackroster_app LOGIN PASSWORD 'trackroster_app';
        END IF;
      END $$;
    `);
    await client.query('GRANT CONNECT ON DATABASE trackroster_backend_test TO trackroster_app');
    await client.query('GRANT USAGE ON SCHEMA public TO trackroster_app');
    await client.query(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trackroster_app',
    );
    await client.query(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO trackroster_app',
    );

    if (!grantObjects) {
      return;
    }

    await client.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trackroster_app',
    );
    await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trackroster_app');
    await client.query(`
      DO $$
      DECLARE fn record;
      BEGIN
        FOR fn IN
          SELECT p.oid::regprocedure AS signature
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname LIKE 'trackroster%'
        LOOP
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO trackroster_app', fn.signature);
        END LOOP;
      END $$;
    `);
    await client.query('REVOKE UPDATE, DELETE ON TABLE collision_events FROM trackroster_app');
    await client.query('REVOKE UPDATE, DELETE ON TABLE audit_events FROM trackroster_app');
  } finally {
    await client.end();
  }
}

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
  await provisionRuntimeRole();
  process.exitCode = run('api', 'drizzle-kit', ['migrate', '--config=drizzle.config.ts']);
  if (process.exitCode === 0) {
    await provisionRuntimeRole({ grantObjects: true });
  }
} else if (mode === 'api' || mode === 'worker') {
  await provisionRuntimeRole({ grantObjects: true });
  process.exitCode = run(mode, 'vitest', [
    'run',
    '--config=vitest.integration.config.ts',
    ...filters,
  ]);
} else if (mode === 'integration') {
  await provisionRuntimeRole({ grantObjects: true });
  const apiStatus = run('api', 'vitest', ['run', '--config=vitest.integration.config.ts']);
  const workerStatus = run('worker', 'vitest', ['run', '--config=vitest.integration.config.ts']);
  process.exitCode = apiStatus || workerStatus;
} else {
  throw new Error('Use migrate, api, worker, or integration');
}
