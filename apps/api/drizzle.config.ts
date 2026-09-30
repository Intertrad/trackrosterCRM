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

const parsedUrl = new URL(url);
const configuredRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
const isProduction = process.env.NODE_ENV?.toLowerCase() === 'production';
const usesRequiredTls = /(?:^|[?&])sslmode=require(?:&|$)/i.test(url);
const allowDevelopmentSelfSigned = !isProduction && usesRequiredTls;

if (isProduction && configuredRejectUnauthorized?.toLowerCase() === 'false') {
  throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED=false is not allowed in production');
}

/*
 * Drizzle Kit passes URL credentials straight to `pg`, whose current
 * pg-connection-string release treats sslmode=require as certificate
 * verification. Supabase pooler connections in local development can use a
 * self-signed chain, so convert the URL to explicit credentials and make the
 * development-only policy unambiguous. Production keeps verification on.
 */
const rejectUnauthorized = configuredRejectUnauthorized
  ? configuredRejectUnauthorized.toLowerCase() !== 'false'
  : !allowDevelopmentSelfSigned;

const dbCredentials = {
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')),
  ssl: {
    rejectUnauthorized,
  },
};

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: '../../database/migrations',
  dbCredentials,
});
