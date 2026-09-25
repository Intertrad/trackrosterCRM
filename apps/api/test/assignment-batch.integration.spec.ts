import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import { getSeedDatabase } from './support/seed.js';
import { withTenantContext } from '../src/database/tenant-context.js';
import type { Database, DatabaseTransaction } from '../src/database/database.types.js';
import {
  auditEvents,
  assignmentRules,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaignTerritories,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  membershipSettings,
  organizations,
  teams,
  teamSettings,
  tenantMemberships,
  tenantRolePermissions,
  tenants,
  territories,
  territoryAssignments,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { AssignmentBatchService } from '../src/assignments/assignment-batch.service.js';
describe('Bulk assignment and saved rules', () => {
  let app: NestFastifyApplication, db: Database, applicationDb: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID(),
    admin = randomUUID(),
    director = randomUUID(),
    member = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    otherOrg = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    otherTeam = randomUUID(),
    outsideTeam = randomUUID(),
    campaign = randomUUID(),
    foreignCampaign = randomUUID(),
    territory = randomUUID();
  const actors = [admin, director, member, foreign],
    tokens = new Map<string, string>();
  const call = (
    method: 'POST' | 'GET' | 'PATCH' | 'DELETE',
    url: string,
    body?: object,
    actor = admin,
    key: string = randomUUID(),
    version?: string,
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload: body,
      headers: {
        authorization: `Bearer ${tokens.get(actor)}`,
        'idempotency-key': key,
        ...(version ? { 'if-match': version } : {}),
      },
    });
  const prospect = async (longitude: number | null = 2.5, latitude: number | null = 48.5) => {
    const e = randomUUID(),
      p = randomUUID();
    await db.insert(establishments).values({
      id: e,
      tenantId,
      name: e,
      normalizedName: e,
      countryCode: 'FR',
      longitude,
      latitude,
    });
    await db
      .insert(campaignProspects)
      .values({ id: p, tenantId, campaignId: campaign, establishmentId: e });
    return p;
  };
  const batch = (
    ids: string[],
    options: object = {},
    actor = admin,
    mode = 'bulk',
    key: string = randomUUID(),
  ) =>
    call(
      'POST',
      `/assignments/${mode}`,
      { campaignId: campaign, prospectIds: ids, ...options },
      actor,
      key,
    );
  const createRule = (options: object = {}, actor = admin) =>
    call(
      'POST',
      '/assignment-rules',
      {
        campaignId: campaign,
        name: 'Allocation',
        strategy: 'round_robin',
        targets: [{ teamId: team }, { teamId: otherTeam }],
        ...options,
      },
      actor,
    );
  const assignments = () =>
    db
      .select()
      .from(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.tenantId, tenantId));
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();

    /*
     * Fixtures use the privileged connection, but the mid-batch rollback case
     * injects a fault into the transaction the *request* runs in, so it has to
     * spy on the connection the application actually uses. Those are two
     * different objects and the distinction is easy to lose: spying on the seed
     * handle intercepts nothing the request does, the batch simply succeeds, and
     * the test reads as a missing rollback rather than a mis-aimed spy.
     */
    applicationDb = app.get(DATABASE);
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await withTenantContext(db, tenantId, async (tx) => {
      await tx
        .insert(organizations)
        .values([org, otherOrg].map((id) => ({ id, tenantId, name: id, slug: id })));
      await tx.insert(teams).values(
        [team, otherTeam, outsideTeam].map((id) => ({
          id,
          tenantId,
          organizationId: id === outsideTeam ? otherOrg : org,
          name: id,
          slug: id,
        })),
      );
    });
    await withTenantContext(db, foreignTenantId, (tx) =>
      tx
        .insert(organizations)
        .values({ id: foreignOrg, tenantId: foreignTenantId, name: foreignOrg, slug: foreignOrg }),
    );
    const password = 'GeographicAllocation123!';
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(actors.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await withTenantContext(db, tenantId, async (tx) => {
      await tx.insert(tenantMemberships).values(
        actors
          .filter((id) => id !== foreign)
          .map((id) => ({
            id,
            identityId: id,
            tenantId,
            status: 'active' as const,
            activatedAt: sql`now()`,
          })),
      );
      await tx.insert(userAccessGrants).values([
        { tenantId, userId: admin, role: 'client_admin', scopeType: 'tenant' },
        {
          tenantId,
          userId: director,
          role: 'director',
          scopeType: 'organization',
          organizationId: org,
        },
        {
          tenantId,
          userId: member,
          role: 'prospector',
          scopeType: 'team',
          organizationId: org,
          teamId: team,
        },
      ]);
      await tx
        .insert(campaigns)
        .values({ id: campaign, tenantId, organizationId: org, name: campaign, status: 'active' });
      await tx.insert(territories).values({
        id: territory,
        tenantId,
        name: territory,
        boundary: sql`ST_Multi(ST_MakeEnvelope(2,48,3,49,4326))`,
      });
      await tx
        .insert(campaignTerritories)
        .values({ tenantId, campaignId: campaign, territoryId: territory });
    });
    await withTenantContext(db, foreignTenantId, async (tx) => {
      await tx.insert(tenantMemberships).values({
        id: foreign,
        identityId: foreign,
        tenantId: foreignTenantId,
        status: 'active',
        activatedAt: sql`now()`,
      });
      await tx.insert(userAccessGrants).values({
        tenantId: foreignTenantId,
        userId: foreign,
        role: 'client_admin',
        scopeType: 'tenant',
      });
      await tx.insert(campaigns).values({
        id: foreignCampaign,
        tenantId: foreignTenantId,
        organizationId: foreignOrg,
        name: foreignCampaign,
        status: 'active',
      });
    });
    for (const id of actors) {
      const result = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(result.statusCode, result.body).toBe(200);
      tokens.set(id, result.json().accessToken);
    }
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db
      .delete(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.role, 'manager')));
    for (const t of [
      assignmentRules,
      campaignProspectAssignments,
      campaignProspects,
      establishments,
      territoryAssignments,
      membershipSettings,
      teamSettings,
      tenantRolePermissions,
    ])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    await db.update(campaigns).set({ status: 'active' }).where(eq(campaigns.id, campaign));
    await db.update(territories).set({ status: 'active' }).where(eq(territories.id, territory));
    await db.update(teams).set({ status: 'active' }).where(eq(teams.tenantId, tenantId));
    await db
      .update(tenantMemberships)
      .set({ status: 'active', suspendedAt: null })
      .where(eq(tenantMemberships.id, member));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      for (const t of [
        idempotencyRecords,
        auditEvents,
        assignmentRules,
        territoryAssignments,
        campaignTerritories,
        campaigns,
        territories,
        authSessions,
        userAccessGrants,
        tenantMemberships,
        teams,
        organizations,
      ])
        await db.delete(t).where(inArray(t.tenantId, ids));
      await db.delete(identities).where(inArray(identities.id, actors));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  });
  it('previews without writes and assigns the whole selection with one audit per assignment', async () => {
    const ids = [await prospect(), await prospect()].sort();
    const preview = await batch(ids, { teamId: team, assignedUserId: member }, admin, 'preview');
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json()).toMatchObject({ canApply: true, proposed: 2, assigned: 0 });
    expect(await assignments()).toHaveLength(0);
    const applied = await batch(ids, { teamId: team, assignedUserId: member }, director);
    expect(applied.statusCode, applied.body).toBe(201);
    expect(applied.json()).toMatchObject({ assigned: 2, conflicts: 0 });
    expect(await assignments()).toHaveLength(2);
    const audits = await db.select().from(auditEvents).where(inArray(auditEvents.resourceId, ids));
    expect(audits).toHaveLength(2);
    expect(audits[0]!.metadata).toMatchObject({ source: 'bulk_assignment', campaignId: campaign });
  });
  it('replays a successful batch without new assignments or evidence', async () => {
    const p = await prospect(),
      key = randomUUID();
    const first = await batch([p], { teamId: team }, admin, 'bulk', key);
    expect(first.statusCode, first.body).toBe(201);
    expect((await batch([p], { teamId: team }, admin, 'bulk', key)).json()).toEqual(first.json());
    expect(await assignments()).toHaveLength(1);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.resourceId, p))).toHaveLength(
      1,
    );
    expect((await batch([await prospect()], { teamId: team }, admin, 'bulk', key)).statusCode).toBe(
      409,
    );
  });
  it('rejects invalid, duplicate, missing and oversized input before writing', async () => {
    const p = await prospect();
    for (const ids of [
      [],
      [p, p],
      [p, p.toUpperCase()],
      Array.from({ length: 101 }, () => randomUUID()),
    ])
      expect((await batch(ids, { teamId: team })).statusCode).toBe(400);
    expect((await batch([p], {})).statusCode).toBe(400);
    expect((await batch([p], { teamId: 'invalid' })).statusCode).toBe(400);
    expect((await batch([p], { teamId: team, extra: 'unsupported' })).statusCode).toBe(400);
    expect((await batch([p, randomUUID()], { teamId: team })).statusCode).toBe(404);
    expect(await assignments()).toHaveLength(0);
  });
  it('preserves existing ownership and makes a mixed conflict batch atomic', async () => {
    const p = await prospect(),
      free = await prospect();
    expect((await batch([p], { teamId: team })).statusCode).toBe(201);
    const result = await batch([p, free], { teamId: otherTeam }, admin, 'preview');
    expect(result.json()).toMatchObject({ canApply: false, proposed: 1, conflicts: 1 });
    const applied = await batch([p, free], { teamId: otherTeam });
    expect(applied.statusCode, applied.body).toBe(409);
    expect(applied.json().code).toBe('ASSIGNMENT_BATCH_CONFLICT');
    expect(await assignments()).toHaveLength(1);
    expect((await assignments())[0]!.teamId).toBe(team);
  });
  it('counts capacity across the entire selection and competing requests', async () => {
    await db
      .insert(teamSettings)
      .values({ tenantId, organizationId: org, teamId: team, capacity: 1 });
    const ids = [await prospect(), await prospect()];
    expect((await batch(ids, { teamId: team }, admin, 'preview')).json()).toMatchObject({
      proposed: 1,
      conflicts: 1,
      canApply: false,
    });
    expect((await batch(ids, { teamId: team })).statusCode).toBe(409);
    expect(await assignments()).toHaveLength(0);
    const race = await Promise.all(ids.map((p) => batch([p], { teamId: team })));
    expect(race.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await assignments()).toHaveLength(1);
  });
  it('shares team capacity with the legacy single-assignment route', async () => {
    await db
      .insert(teamSettings)
      .values({ tenantId, organizationId: org, teamId: team, capacity: 1 });
    const first = await prospect(),
      second = await prospect();
    const race = await Promise.all([
      batch([first], { teamId: team }),
      call('POST', `/campaigns/${campaign}/prospects/${second}/assignment`, { teamId: team }),
    ]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(await assignments()).toHaveLength(1);
  });
  it('checks membership capacity, activity and exact team prospector grants', async () => {
    const p = await prospect();
    await db.insert(membershipSettings).values({ tenantId, membershipId: member, capacity: 0 });
    expect((await batch([p], { teamId: team, assignedUserId: member })).statusCode).toBe(409);
    expect(
      (await batch([p], { teamId: otherTeam, assignedUserId: member }, admin, 'preview')).json()
        .decisions[0].outcome,
    ).toBe('ineligible_target');
    expect((await batch([p], { teamId: team, assignedUserId: director })).statusCode).toBe(409);
    expect((await batch([p], { teamId: outsideTeam })).statusCode).toBe(400);
    expect(await assignments()).toHaveLength(0);
  });
  it('permits managers only for their own team and forbids prospectors/foreign tenants', async () => {
    await db.insert(userAccessGrants).values({
      tenantId,
      userId: member,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    expect((await batch([await prospect()], { teamId: team }, member)).statusCode).toBe(201);
    expect((await batch([await prospect()], { teamId: otherTeam }, member)).statusCode).toBe(403);
    expect((await batch([await prospect()], { teamId: team }, foreign)).statusCode).toBe(403);
    expect((await createRule({}, member)).statusCode).toBe(403);
  });
  it('rechecks revoked permission before replay and inside the transaction', async () => {
    const p = await prospect(),
      key = randomUUID();
    expect((await batch([p], { teamId: team }, director, 'bulk', key)).statusCode).toBe(201);
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    expect((await batch([p], { teamId: team }, director, 'bulk', key)).statusCode).toBe(403);
    await db.delete(tenantRolePermissions).where(eq(tenantRolePermissions.tenantId, tenantId));
    const next = await prospect(),
      service = app.get(AssignmentBatchService),
      original = service.authorizeBatch.bind(service);
    let signal!: () => void;
    const checked = new Promise<void>((r) => (signal = r));
    vi.spyOn(service, 'authorizeBatch').mockImplementation(async (...args) => {
      const value = await original(...args);
      if (!args[2]) signal();
      return value;
    });
    let pending!: ReturnType<typeof batch>;
    await db.transaction(async (tx) => {
      await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for('no key update');
      pending = batch([next], { teamId: team }, director);
      void pending.then(() => undefined);
      await checked;
      await tx
        .insert(tenantRolePermissions)
        .values({ tenantId, role: 'director', permissions: [] });
    });
    expect((await pending).statusCode).toBe(403);
    expect(await assignments()).toHaveLength(1);
  });
  it('rejects excluded prospects and terminal campaigns', async () => {
    const p = await prospect();
    await db
      .update(campaignProspects)
      .set({ status: 'excluded' })
      .where(eq(campaignProspects.id, p));
    expect((await batch([p], { teamId: team }, admin, 'preview')).json().decisions[0].outcome).toBe(
      'inactive_prospect',
    );
    await db.update(campaigns).set({ status: 'completed' }).where(eq(campaigns.id, campaign));
    expect((await batch([p], { teamId: team })).statusCode).toBe(409);
  });
  it('creates, lists, conditionally updates and deactivates saved rules with tenant isolation', async () => {
    const created = await createRule();
    expect(created.statusCode, created.body).toBe(201);
    const r = created.json();
    const list = await call('GET', `/assignment-rules?campaignId=${campaign}`);
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect(
      (await call('GET', `/assignment-rules?campaignId=${campaign}`, undefined, foreign))
        .statusCode,
    ).toBe(403);
    const updated = await call(
      'PATCH',
      `/assignment-rules/${r.id}`,
      { name: 'Balanced', priority: 1 },
      admin,
      randomUUID(),
      r.etag,
    );
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({
      name: 'Balanced',
      priority: 1,
      strategy: 'round_robin',
    });
    expect(
      (
        await call(
          'PATCH',
          `/assignment-rules/${r.id}`,
          { name: 'Stale' },
          admin,
          randomUUID(),
          r.etag,
        )
      ).statusCode,
    ).toBe(412);
    expect(
      (
        await call(
          'DELETE',
          `/assignment-rules/${r.id}`,
          undefined,
          admin,
          randomUUID(),
          updated.json().etag,
        )
      ).statusCode,
    ).toBe(200);
    expect((await batch([await prospect()], { ruleId: r.id })).statusCode).toBe(409);
    expect((await call('PATCH', `/assignment-rules/${r.id}`, { isActive: true })).statusCode).toBe(
      200,
    );
    expect((await batch([await prospect()], { ruleId: r.id })).statusCode).toBe(201);
  });
  it('rejects incomplete/unsupported rule definitions and invalid targets', async () => {
    for (const options of [
      { name: '   ' },
      { name: null },
      { targets: [] },
      { targets: [{ teamId: team }, { teamId: team.toUpperCase() }] },
      { targets: [{ teamId: outsideTeam }] },
      { strategy: 'unsupported' },
      { targets: [{ teamId: team, assignedUserId: director }] },
    ]) {
      const result = await createRule(options);
      expect(result.statusCode, result.body).toBe(400);
    }
    expect((await call('POST', '/assignment-rules', { campaignId: campaign })).statusCode).toBe(
      400,
    );
    expect(
      await db.select().from(assignmentRules).where(eq(assignmentRules.tenantId, tenantId)),
    ).toHaveLength(0);
  });
  it('simulates round robin without moving its cursor, then continues across successful batches', async () => {
    const rule = (await createRule()).json();
    const ids = [await prospect(), await prospect(), await prospect()].sort();
    const preview = await call('POST', `/assignment-rules/${rule.id}/simulate`, {
      prospectIds: ids,
    });
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().decisions.map((d: { teamId: string }) => d.teamId)).toEqual([
      team,
      otherTeam,
      team,
    ]);
    expect(await assignments()).toHaveLength(0);
    expect(
      (await call('GET', `/assignment-rules?campaignId=${campaign}`)).json().items[0].nextTarget,
    ).toBe(0);
    const applied = await batch(ids, { ruleId: rule.id });
    expect(applied.statusCode, applied.body).toBe(201);
    expect(applied.json().decisions.map((d: { teamId: string }) => d.teamId)).toEqual([
      team,
      otherTeam,
      team,
    ]);
    expect((await batch([await prospect()], { ruleId: rule.id })).json().decisions[0].teamId).toBe(
      otherTeam,
    );
    const evidence = await db.select().from(auditEvents).where(eq(auditEvents.resourceId, ids[0]!));
    expect(evidence[0]!.metadata).toMatchObject({
      ruleId: rule.id,
      ruleSnapshot: { strategy: 'round_robin', nextTarget: 0 },
    });
  });
  it('balances capacity using live workloads and shares capacity for repeated team/member targets', async () => {
    await db.insert(teamSettings).values([
      { tenantId, organizationId: org, teamId: team, capacity: 1 },
      { tenantId, organizationId: org, teamId: otherTeam, capacity: 3 },
    ]);
    await db.insert(membershipSettings).values({ tenantId, membershipId: member, capacity: 1 });
    const rule = (
      await createRule({
        strategy: 'capacity',
        targets: [
          { teamId: team },
          { teamId: team, assignedUserId: member },
          { teamId: otherTeam },
        ],
      })
    ).json();
    const ids = [await prospect(), await prospect(), await prospect(), await prospect()];
    const result = await batch(ids, { ruleId: rule.id });
    expect(result.statusCode, result.body).toBe(201);
    expect(
      result.json().decisions.filter((d: { teamId: string }) => d.teamId === team),
    ).toHaveLength(1);
    expect((await batch([await prospect()], { ruleId: rule.id })).statusCode).toBe(409);
  });
  it('skips newly ineligible rule targets and allows deactivation after target removal', async () => {
    const rule = (
      await createRule({
        targets: [{ teamId: team, assignedUserId: member }, { teamId: otherTeam }],
      })
    ).json();
    await db
      .update(tenantMemberships)
      .set({ status: 'suspended', suspendedAt: new Date() })
      .where(eq(tenantMemberships.id, member));
    const result = await batch([await prospect()], { ruleId: rule.id });
    expect(result.statusCode, result.body).toBe(201);
    expect(result.json().decisions[0].teamId).toBe(otherTeam);
    expect((await call('DELETE', `/assignment-rules/${rule.id}`)).statusCode).toBe(200);
  });
  it('does not advance round robin or write audit evidence on failed batches', async () => {
    await db.insert(teamSettings).values([
      { tenantId, organizationId: org, teamId: team, capacity: 1 },
      { tenantId, organizationId: org, teamId: otherTeam, capacity: 1 },
    ]);
    const rule = (await createRule()).json(),
      ids = [await prospect(), await prospect(), await prospect()];
    expect((await batch(ids, { ruleId: rule.id })).statusCode).toBe(409);
    expect(await assignments()).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(inArray(auditEvents.resourceId, ids)),
    ).toHaveLength(0);
    expect(
      (await call('GET', `/assignment-rules?campaignId=${campaign}`)).json().items[0].nextTarget,
    ).toBe(0);
  });
  it('rejects mixed manual/rule input and a rule from another campaign or tenant', async () => {
    const rule = (await createRule()).json(),
      p = await prospect();
    expect((await batch([p], { ruleId: rule.id, teamId: team })).statusCode).toBe(400);
    expect((await batch([p], { ruleId: rule.id }, foreign)).statusCode).toBe(404);
    expect((await batch([p], { ruleId: rule.id, campaignId: foreignCampaign })).statusCode).toBe(
      400,
    );
  });
  it('rolls back assignments, cursor and audit when evidence persistence fails mid-batch', async () => {
    const rule = (await createRule()).json();
    const ids = [await prospect(), await prospect()];
    const original = applicationDb.transaction.bind(applicationDb);
    let auditWrites = 0;

    /*
     * The wrapper has to re-wrap nested transactions, and that is the whole
     * difficulty here.
     *
     * The interceptor opens the request's transaction, and the batch service
     * then opens its own inside it, which PostgreSQL makes a savepoint. A proxy
     * that only intercepts `insert` hands back the *real* executor for
     * `transaction`, so every write the service performed through that inner
     * executor went straight past the counter and the synthetic failure never
     * fired — the batch simply succeeded and the case read as a missing
     * rollback. Repositories resolve their executor through AsyncLocalStorage
     * rather than taking one as an argument, so there is no other seam to inject
     * at from outside.
     */
    const withFailingAudit = (executor: DatabaseTransaction): DatabaseTransaction =>
      new Proxy(executor, {
        get(target, key, receiver) {
          if (key === 'insert')
            return (table: Parameters<Database['insert']>[0]) => {
              if (table === auditEvents && ++auditWrites === 2)
                throw new Error('Synthetic audit storage failure');

              return target.insert(table);
            };

          if (key === 'transaction')
            return (
              nested: (transaction: DatabaseTransaction) => Promise<unknown>,
              nestedConfig?: unknown,
            ) =>
              (target.transaction as (...args: unknown[]) => Promise<unknown>)(
                (inner: DatabaseTransaction) => nested(withFailingAudit(inner)),
                nestedConfig,
              );

          return Reflect.get(target, key, receiver);
        },
      }) as DatabaseTransaction;

    vi.spyOn(applicationDb, 'transaction').mockImplementation((callback, config) =>
      original(async (tx) => callback(withFailingAudit(tx)), config),
    );
    const result = await batch(ids, { ruleId: rule.id });
    expect(result.statusCode, result.body).toBe(500);
    vi.restoreAllMocks();
    expect(await assignments()).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(inArray(auditEvents.resourceId, ids)),
    ).toHaveLength(0);
    expect(
      (await call('GET', `/assignment-rules?campaignId=${campaign}`)).json().items[0].nextTarget,
    ).toBe(0);
    expect((await batch(ids, { ruleId: rule.id })).statusCode).toBe(201);
  });
  it('serializes round-robin batches and retains their cursor through idempotent retries', async () => {
    const rule = (await createRule()).json(),
      p = await prospect(),
      q = await prospect(),
      key = randomUUID();
    const results = await Promise.all([
      batch([p], { ruleId: rule.id }, admin, 'bulk', key),
      batch([q], { ruleId: rule.id }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([201, 201]);
    expect(new Set(results.map((r) => r.json().decisions[0].teamId))).toEqual(
      new Set([team, otherTeam]),
    );
    expect((await batch([p], { ruleId: rule.id }, admin, 'bulk', key)).json()).toEqual(
      results[0]!.json(),
    );
    expect(
      (await call('GET', `/assignment-rules?campaignId=${campaign}`)).json().items[0].nextTarget,
    ).toBe(0);
  });
  it('allocates skill rules only to targets matching every configured skill', async () => {
    const created = await createRule({
      strategy: 'skill',
      requiredSkills: ['French', 'B2B'],
      targets: [
        { teamId: team, skills: ['french'] },
        { teamId: otherTeam, skills: ['FRENCH', 'b2b'] },
      ],
    });
    expect(created.statusCode, created.body).toBe(201);
    const rule = created.json();
    expect(rule.requiredSkills).toEqual(['french', 'b2b']);
    const result = await batch([await prospect()], { ruleId: rule.id });
    expect(result.statusCode, result.body).toBe(201);
    expect(result.json().decisions[0].teamId).toBe(otherTeam);
    expect((await createRule({ strategy: 'skill', requiredSkills: [] })).statusCode).toBe(400);
    const missing = (await createRule({ strategy: 'skill', requiredSkills: ['technical'] })).json();
    expect(
      (await batch([await prospect()], { ruleId: missing.id }, admin, 'preview')).json()
        .decisions[0].outcome,
    ).toBe('no_skill_match');
  });
  it('allocates proximity rules by configured dispatch distance and falls back when the nearest is full', async () => {
    const rule = (
      await createRule({
        strategy: 'proximity',
        targets: [
          { teamId: team, location: { longitude: 2.5, latitude: 48.5 } },
          { teamId: otherTeam, location: { longitude: 2.6, latitude: 48.5 } },
        ],
        maxDistanceKm: 20,
      })
    ).json();
    await db
      .insert(teamSettings)
      .values({ tenantId, organizationId: org, teamId: team, capacity: 1 });
    const ids = [await prospect(), await prospect()].sort();
    const result = await batch(ids, { ruleId: rule.id });
    expect(result.statusCode, result.body).toBe(201);
    expect(result.json().decisions.map((d: { teamId: string }) => d.teamId)).toEqual([
      team,
      otherTeam,
    ]);
    expect(result.json().decisions[0].distanceKm).toBe(0);
    expect(result.json().decisions[1].distanceKm).toBeGreaterThan(7);
  });
  it('reports missing coordinates and radius exclusions without partial allocation', async () => {
    const rule = (
      await createRule({
        strategy: 'proximity',
        targets: [{ teamId: team, location: { longitude: 2.5, latitude: 48.5 } }],
        maxDistanceKm: 1,
      })
    ).json();
    const near = await prospect(),
      far = await prospect(4, 48.5),
      missing = await prospect(null, null);
    const preview = await batch([near, far, missing], { ruleId: rule.id }, admin, 'preview');
    expect(preview.statusCode, preview.body).toBe(200);
    expect(
      preview
        .json()
        .decisions.map((d: { outcome: string }) => d.outcome)
        .sort(),
    ).toEqual(['missing_coordinates', 'no_proximity_match', 'proposed']);
    expect((await batch([near, far], { ruleId: rule.id })).statusCode).toBe(409);
    expect(await assignments()).toHaveLength(0);
    expect(
      (await call('PATCH', `/assignment-rules/${rule.id}`, { maxDistanceKm: null })).statusCode,
    ).toBe(200);
    expect((await batch([far], { ruleId: rule.id })).statusCode).toBe(201);
  });
  it('returns scoped ranked suggestions without allocating or advancing round robin', async () => {
    const rule = (
        await createRule({
          strategy: 'proximity',
          targets: [
            { teamId: otherTeam, location: { longitude: 3, latitude: 48.5 } },
            { teamId: team, location: { longitude: 2.5, latitude: 48.5 } },
          ],
        })
      ).json(),
      p = await prospect();
    const path = `/assignment-suggestions?ruleId=${rule.id}&campaignProspectId=${p}`;
    const result = await call('GET', path);
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().candidates.map((c: { teamId: string }) => c.teamId)).toEqual([
      team,
      otherTeam,
    ]);
    expect(result.json().candidates[0]).toMatchObject({
      distanceKm: 0,
      availableTeamCapacity: 100,
    });
    expect(await assignments()).toHaveLength(0);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: `${member}@example.test`, password: 'GeographicAllocation123!' },
    });
    expect(login.statusCode, login.body).toBe(200);
    tokens.set(member, login.json().accessToken);
    expect((await call('GET', path, undefined, member)).statusCode).toBe(403);
    expect((await call('GET', path, undefined, foreign)).statusCode).toBe(404);
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    expect((await call('GET', path, undefined, director)).statusCode).toBe(403);
  });
  it('validates strategy configuration, bounded coordinates and skill tag syntax', async () => {
    for (const options of [
      { strategy: 'proximity' },
      { strategy: 'skill', requiredSkills: [] },
      { strategy: 'skill', requiredSkills: ['invalid tag'] },
      {
        strategy: 'proximity',
        targets: [{ teamId: team, location: { longitude: 200, latitude: 48 } }],
      },
      { strategy: 'proximity', targets: [{ teamId: team, location: { longitude: 2 } }] },
      { maxDistanceKm: -1 },
    ]) {
      const result = await createRule(options);
      expect(result.statusCode, result.body).toBe(400);
    }
  });
});
