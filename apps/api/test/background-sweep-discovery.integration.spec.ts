import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { AppModule } from '../src/app.module.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { getSeedDatabase } from './support/seed.js';

/*
 * The property TR-902 exists to protect.
 *
 * Every timer-driven sweep asks a question that spans tenants, because the
 * queue it drains is shared. Those sweeps run outside any request, so nothing
 * has set `trackroster.tenant_id` for them, and once the API connects as
 * `trackroster_app` a plain cross-tenant read returns zero rows. The sweep then
 * does nothing — no error, no log, no work — until someone notices that
 * exports never finish or reservation evidence never reconciles.
 *
 * That failure is invisible by construction, so it needs a test that fails
 * loudly if discovery is ever reverted to an ordinary query, or if the grant
 * that makes the definer functions callable is dropped.
 *
 * These assertions go through the application's own connection, which is the
 * restricted role, so they measure what the sweep will actually see.
 */
const SWEEP_FUNCTIONS = [
  'trackroster_pending_action_effects',
  'trackroster_claimable_export_jobs',
  'trackroster_expirable_export_jobs',
  'trackroster_reconcilable_reservations',
] as const;

describe.skipIf(!process.env.DATABASE_URL)('Background sweep discovery', () => {
  let application: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>;
  let database: Database;
  const tenants: string[] = [];
  const identities: string[] = [];
  const jobs: string[] = [];

  beforeAll(async () => {
    application = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });
    database = application.get<Database>(DATABASE);

    const seed = getSeedDatabase();

    /* Two tenants, because the whole point is that one sweep serves both. */
    for (const label of ['a', 'b']) {
      const tenantId = randomUUID();
      const identityId = randomUUID();
      const membershipId = randomUUID();
      const jobId = randomUUID();
      const suffix = `${label}-${tenantId.slice(0, 8)}`;

      /* One statement per call: a parameterised query cannot carry several. */
      await seed.execute(
        sql`insert into tenants (id, name, slug) values (${tenantId}, ${`Sweep ${suffix}`}, ${`sweep-${suffix}`})`,
      );
      await seed.execute(
        sql`insert into identities (id, email) values (${identityId}, ${`sweep-${suffix}@trackroster.test`})`,
      );
      await seed.execute(
        sql`insert into tenant_memberships (id, tenant_id, identity_id, status, activated_at) values (${membershipId}, ${tenantId}, ${identityId}, 'active', now())`,
      );
      await seed.execute(
        sql`insert into export_jobs (id, tenant_id, requester_id, status, request, authority_hash) values (${jobId}, ${tenantId}, ${membershipId}, 'queued', '{}'::jsonb, ${`hash-${suffix}`})`,
      );

      tenants.push(tenantId);
      identities.push(identityId);
      jobs.push(jobId);
    }
  });

  afterAll(async () => {
    const seed = getSeedDatabase();

    /*
     * Children first, and memberships before identities: neither the membership
     * nor the export job cascades, and the membership holds the identity down.
     */
    for (const tenantId of tenants) {
      await seed.execute(sql`delete from export_jobs where tenant_id = ${tenantId}`);
      await seed.execute(sql`delete from tenant_memberships where tenant_id = ${tenantId}`);
    }
    for (const identityId of identities) {
      await seed.execute(sql`delete from identities where id = ${identityId}`);
    }
    for (const tenantId of tenants) {
      await seed.execute(sql`delete from tenants where id = ${tenantId}`);
    }
    await application?.close();
  });

  it('hides the shared queue from a context-free read, which is why discovery is needed', async () => {
    const direct = await database.execute<{ total: string }>(
      sql`select count(*) as total from export_jobs`,
    );

    /*
     * Zero, not "the two rows just seeded". If this ever returns a count the
     * policies have stopped applying to the application's connection, and the
     * isolation guarantee is gone — which is a bigger failure than the sweep.
     */
    expect(Number(direct.rows[0]?.total)).toBe(0);
  });

  it('discovers queued work across every tenant through the definer function', async () => {
    const discovered = await database.execute<{ id: string; tenant_id: string }>(
      sql`select id, tenant_id from trackroster_claimable_export_jobs(100)`,
    );

    const found = discovered.rows.filter((row) => jobs.includes(row.id));

    expect(found).toHaveLength(2);
    expect(new Set(found.map((row) => row.tenant_id))).toEqual(new Set(tenants));
  });

  it('keeps every sweep discovery function privileged and unreachable by PUBLIC', async () => {
    const audited = await database.execute<{
      name: string;
      is_definer: boolean;
      public_can_execute: boolean;
      app_can_execute: boolean;
    }>(sql`
      select
        p.proname as name,
        p.prosecdef as is_definer,
        has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute,
        has_function_privilege(current_user, p.oid, 'EXECUTE') as app_can_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'trackroster%'
    `);

    const byName = new Map(audited.rows.map((row) => [row.name, row]));

    expect(
      [...byName.keys()].filter((name) => SWEEP_FUNCTIONS.includes(name as never)).sort(),
    ).toEqual([...SWEEP_FUNCTIONS].sort());

    for (const name of SWEEP_FUNCTIONS) {
      const row = byName.get(name)!;
      /* Definer, or it cannot cross the boundary it exists to cross. */
      expect(row.is_definer, `${row.name} must be SECURITY DEFINER`).toBe(true);
      /* Not PUBLIC, or the boundary is open to anything that can reach the database. */
      expect(row.public_can_execute, `${row.name} must not be executable by PUBLIC`).toBe(false);
      /* Callable by the application, or the sweep silently stalls again. */
      expect(row.app_can_execute, `${row.name} must be executable by the runtime role`).toBe(true);
    }
  });
});
