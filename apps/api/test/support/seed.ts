import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../src/database/schema/index.js';
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

  pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });

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
