import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { createIntegrationPool } from './integration-pool.js';

import * as schema from '../../src/database/schema/index.js';
import { runWithTenantExecutor } from '../../src/database/request-tenant-executor.js';
import type { Database } from '../../src/database/database.types.js';

/**
 * A privileged connection for building and inspecting test fixtures.
 *
 * Integration suites seed across several tenants before any request is made,
 * which is deliberately not something the application is allowed to do. The
 * application's own connection is therefore the wrong tool: once the API runs
 * as the non-privileged runtime role, Row-Level Security rejects an
 * `insert into organizations` that carries no tenant context — correctly, and
 * in `beforeAll`, where it reads as 52 broken suites rather than as the
 * policy doing its job.
 *
 * Separating the two mirrors production, where migrations and seeds run as
 * the owner and the API does not. It also keeps the suites honest: anything
 * asserted through `application.inject` still crosses the real authorization
 * and tenancy path, while only the scaffolding around it is privileged.
 *
 * `DATABASE_SEED_URL` exists so the two can differ. When it is unset the
 * owner credentials in `DATABASE_URL` are still in use and the distinction
 * costs nothing.
 */
let pool: Pool | undefined;
let database: Database | undefined;

export function getSeedDatabase(): Database {
  if (database) {
    return database;
  }

  const connectionString = process.env.DATABASE_SEED_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_SEED_URL or DATABASE_URL is required to seed integration fixtures');
  }

  pool = createIntegrationPool(connectionString);

  /*
   * Plain drizzle, not the request-aware wrapper the application provider
   * builds: seeding has no request and no single tenant to be scoped to.
   */
  database = drizzle(pool, { schema });

  return database;
}

export async function closeSeedDatabase(): Promise<void> {
  await pool?.end();

  pool = undefined;
  database = undefined;
}

/**
 * Runs fixture code with the privileged connection installed as the ambient
 * executor.
 *
 * Suites that build fixtures through container-resolved repositories rather
 * than raw inserts have a problem that `getSeedDatabase()` alone does not
 * solve: those repositories hold the *application's* connection, and default
 * to it whenever the caller passes no executor. Outside a request there is no
 * tenant scope, so once the application connects as `trackroster_app` the RLS
 * policies reject the write — including the cross-tenant fixtures that make
 * isolation testable at all.
 *
 * `createRequestAwareDatabase` already resolves every repository call against
 * whatever executor is ambient, so entering the scope with a privileged
 * transaction redirects all of them at once, without rebinding each
 * repository or threading an executor through every call.
 *
 * The scope installs the connection itself rather than a transaction, so that
 * fixtures mixing repository calls with direct `getSeedDatabase()` writes all
 * land on one connection and can see each other. Wrapping them in a
 * transaction instead leaves the direct writes on a second pooled connection,
 * where the uncommitted rows are invisible and foreign keys fail. No tenant
 * context is set because the privileged role bypasses RLS regardless.
 *
 * Only fixture work belongs inside. An `application.inject` call made in this
 * scope would run the request itself on the privileged connection and quietly
 * stop exercising RLS, which is the opposite of the point — perform logins and
 * assertions outside it.
 */
export function withSeedScope<T>(work: () => Promise<T>): Promise<T> {
  return runWithTenantExecutor(getSeedDatabase(), work);
}
