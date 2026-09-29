import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({
  path: '../../.env',
});

/*
 * Migrations run as the database owner, not as the application.
 *
 * `DATABASE_URL` is the application's connection, and since TR-901 it points
 * at `trackroster_app` — a role with no DDL rights, deliberately, so that the
 * tenant policies apply to it. Using it here would fail on the first
 * `CREATE TABLE` with "permission denied for schema public".
 *
 * `DATABASE_MIGRATION_URL` carries the owner credentials. The fallback to
 * `DATABASE_URL` keeps a single-URL setup working, which is still the right
 * shape for a throwaway database or a fresh clone that has not split the two
 * yet; it fails loudly at the first DDL statement rather than silently doing
 * the wrong thing.
 */
const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_MIGRATION_URL or DATABASE_URL is required to run migrations');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: '../../database/migrations',
  dbCredentials: {
    url,
  },
});
