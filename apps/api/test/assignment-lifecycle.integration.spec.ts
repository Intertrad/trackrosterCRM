import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import { withTenantContext } from '../src/database/tenant-context.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  assignmentRules,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaignTerritories,
  campaigns,
  contactConsents,
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
import { AssignmentLifecycleService } from '../src/assignments/assignment-lifecycle.service.js';
describe('Canonical assignment lifecycle', () => {
  let app: NestFastifyApplication, db: Database;
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
    otherCampaign = randomUUID(),
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
  const create = (p: string, options: object = {}, actor = admin, key: string = randomUUID()) =>
    call(
      'POST',
      '/assignments',
      { campaignId: campaign, campaignProspectId: p, teamId: team, ...options },
      actor,
      key,
    );
  const mutate = (
    id: string,
    operation: string,
    body: object = { reason: 'Completed work' },
    actor = admin,
    key: string = randomUUID(),
    version?: string,
  ) =>
    call(
      operation === 'update' ? 'PATCH' : 'POST',
      `/assignments/${id}${operation === 'update' ? '' : `/${operation}`}`,
      body,
      actor,
      key,
      version,
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
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await withTenantContext(db, tenantId, (tx) =>
      tx
        .insert(organizations)
        .values([org, otherOrg].map((id) => ({ id, tenantId, name: id, slug: id }))),
    );
    await withTenantContext(db, foreignTenantId, (tx) =>
      tx
        .insert(organizations)
        .values({ id: foreignOrg, tenantId: foreignTenantId, name: foreignOrg, slug: foreignOrg }),
    );
    await withTenantContext(db, tenantId, (tx) =>
      tx.insert(teams).values(
        [team, otherTeam, outsideTeam].map((id) => ({
          id,
          tenantId,
          organizationId: id === outsideTeam ? otherOrg : org,
          name: id,
          slug: id,
        })),
      ),
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
            tenantId: id === foreign ? foreignTenantId : tenantId,
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
      await tx.insert(campaigns).values([
        { id: campaign, tenantId, organizationId: org, name: campaign, status: 'active' },
        /* A second organization's campaign, for cross-campaign contention. */
        {
          id: otherCampaign,
          tenantId,
          organizationId: otherOrg,
          name: otherCampaign,
          status: 'active',
        },
      ]);
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
      contactConsents,
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
        contactConsents,
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
  /*
   * The dispatch queue at the scale it now has to work at.
   *
   * The référentiel is 14,649 establishments and a page is at most 100, so every
   * one of these filters has to be applied by the database. The manager screen
   * used to filter the loaded page in the browser, which searched 100 rows and
   * reported nothing for the other 14,549.
   */
  const dispatchProspect = async (
    attributes: {
      name: string;
      category?: 'prospection' | 'cra' | 'douanes_onaf' | 'sante';
      city?: string;
      postalCode?: string;
    },
    campaignId = campaign,
  ) => {
    const e = randomUUID(),
      p = randomUUID();
    await db.insert(establishments).values({
      id: e,
      tenantId,
      name: attributes.name,
      normalizedName: attributes.name.toLowerCase(),
      countryCode: 'FR',
      ...(attributes.category ? { category: attributes.category } : {}),
      ...(attributes.city ? { city: attributes.city } : {}),
      ...(attributes.postalCode ? { postalCode: attributes.postalCode } : {}),
    });
    await db.insert(campaignProspects).values({ id: p, tenantId, campaignId, establishmentId: e });
    return { establishmentId: e, campaignProspectId: p };
  };
  const queue = async (query = '', actor = admin) =>
    call('GET', `/assignments/unassigned?campaignId=${campaign}${query}`, undefined, actor);
  const names = (response: Awaited<ReturnType<typeof queue>>) =>
    response.json().items.map((x: { name: string }) => x.name);
  it('filters the dispatch queue by category, department, city and text, in a readable order', async () => {
    await dispatchProspect({
      name: 'Brigade de Bastia',
      category: 'cra',
      city: 'Bastia',
      postalCode: '20200',
    });
    await dispatchProspect({
      name: 'Commissariat de Lyon',
      category: 'prospection',
      city: 'Lyon',
      postalCode: '69003',
    });
    await dispatchProspect({
      name: 'Douane de Saint-Denis',
      category: 'douanes_onaf',
      city: 'Saint-Denis',
      postalCode: '97400',
    });
    await dispatchProspect({
      name: 'Hopital de Bourg',
      category: 'sante',
      city: 'Bourg-en-Bresse',
      postalCode: '01000',
    });
    const all = await queue();
    expect(all.statusCode, all.body).toBe(200);
    /* Name order, not insertion or uuid order: a manager scans this list. */
    expect(names(all)).toEqual([
      'Brigade de Bastia',
      'Commissariat de Lyon',
      'Douane de Saint-Denis',
      'Hopital de Bourg',
    ]);
    expect(all.json().items[0]).toMatchObject({
      category: 'cra',
      city: 'Bastia',
      postalCode: '20200',
      department: '20',
      contactBlocked: false,
      activeElsewhere: false,
    });
    expect(names(await queue('&category=cra'))).toEqual(['Brigade de Bastia']);
    expect(names(await queue('&city=lyon'))).toEqual(['Commissariat de Lyon']);
    /* Overseas departments are three digits; 974 is not 97. */
    expect(names(await queue('&department=974'))).toEqual(['Douane de Saint-Denis']);
    expect((await queue('&department=97')).statusCode).toBe(400);
    /*
     * Ain, from 01000. The workbook stores that code as the number 1000 because
     * the cell is numeric, and four digits is not a postal code a department can
     * be read from — so an unpadded row answers no department and is missing from
     * this filter entirely rather than answering the wrong one. The converter
     * pads it for exactly that reason.
     */
    expect(names(await queue('&department=01'))).toEqual(['Hopital de Bourg']);
    /* Proof of that, rather than prose: the same establishment, unpadded. */
    await dispatchProspect({ name: 'Zzz non pad', postalCode: '1000' });
    expect(names(await queue('&department=01'))).toEqual(['Hopital de Bourg']);
    expect(
      (await queue('&search=Zzz'))
        .json()
        .items.map((x: { department: string | null }) => x.department),
    ).toEqual([null]);
    expect(names(await queue('&department=20'))).toEqual(['Brigade de Bastia']);
    /* Text search reaches the postal code and the city, not only the name. */
    expect(names(await queue('&search=97400'))).toEqual(['Douane de Saint-Denis']);
    expect(names(await queue('&search=bourg-en'))).toEqual(['Hopital de Bourg']);
    expect(names(await queue('&search=brigade'))).toEqual(['Brigade de Bastia']);
    expect(names(await queue('&search=aucun'))).toEqual([]);
    /* An unknown category is the caller's mistake, not a failed query. */
    expect((await queue('&category=gendarmerie')).statusCode).toBe(400);
  });
  it('pages the dispatch queue in name order from a prospect-id cursor', async () => {
    for (const name of ['Alpha', 'Bravo', 'Charlie'])
      await dispatchProspect({ name, postalCode: '75001' });
    const first = await queue('&limit=2');
    expect(names(first)).toEqual(['Alpha', 'Bravo']);
    const cursor = first.json().nextCursor;
    expect(cursor).toBe(first.json().items[1].campaignProspectId);
    expect(names(await queue(`&limit=2&cursor=${cursor}`))).toEqual(['Charlie']);
    expect((await queue(`&limit=2&cursor=${randomUUID()}`)).statusCode).toBe(400);
  });
  it('reports opposition and work on the same establishment elsewhere, and can exclude both', async () => {
    await dispatchProspect({ name: 'Aaa libre' });
    const opposed = await dispatchProspect({ name: 'Bbb opposition' });
    const contested = await dispatchProspect({ name: 'Ccc ailleurs' });
    await db.insert(contactConsents).values({
      tenantId,
      prospectId: opposed.establishmentId,
      channel: 'all',
      status: 'blocked',
      reason: 'Opposition recorded by the establishment',
      recordedBy: admin,
    });
    /*
     * The same establishment inside another organization's campaign, actively
     * owned there. The prospector's reservation would be refused under the
     * organization collision scope, so a manager is better off seeing it here.
     */
    const elsewhere = randomUUID();
    await db.insert(campaignProspects).values({
      id: elsewhere,
      tenantId,
      campaignId: otherCampaign,
      establishmentId: contested.establishmentId,
    });
    await db.insert(campaignProspectAssignments).values({
      tenantId,
      campaignId: otherCampaign,
      campaignProspectId: elsewhere,
      organizationId: otherOrg,
      teamId: outsideTeam,
    });
    const all = await queue();
    expect(all.statusCode, all.body).toBe(200);
    expect(all.json().items).toEqual([
      expect.objectContaining({ name: 'Aaa libre', contactBlocked: false, activeElsewhere: false }),
      expect.objectContaining({ name: 'Bbb opposition', contactBlocked: true }),
      expect.objectContaining({ name: 'Ccc ailleurs', activeElsewhere: true }),
    ]);
    /* Default behaviour is unchanged: both are reported, neither is hidden. */
    expect(names(await queue('&contactable=true'))).toEqual(['Aaa libre', 'Ccc ailleurs']);
    expect(names(await queue('&availability=uncontested'))).toEqual([
      'Aaa libre',
      'Bbb opposition',
    ]);
    expect(names(await queue('&contactable=true&availability=uncontested'))).toEqual(['Aaa libre']);
  });
  it('creates and filters assignments, reads detail/history and queues unassigned prospects', async () => {
    const p = await prospect(),
      q = await prospect();
    const created = await create(p, { assignedUserId: member });
    expect(created.statusCode, created.body).toBe(201);
    const r = created.json();
    expect(r).toMatchObject({
      status: 'active',
      priority: 'normal',
      endedAt: null,
      assignedUserId: member,
    });
    const list = await call(
      'GET',
      `/assignments?campaignId=${campaign}&teamId=${team}&assignedUserId=${member}&status=active&limit=1`,
    );
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().items).toHaveLength(1);
    expect((await call('GET', `/assignments/${r.id}`)).json().history).toHaveLength(1);
    const queue = await call('GET', `/assignments/unassigned?campaignId=${campaign}`);
    expect(queue.statusCode, queue.body).toBe(200);
    expect(
      queue.json().items.map((x: { campaignProspectId: string }) => x.campaignProspectId),
    ).toEqual([q]);
  });
  it('pauses/resumes without freeing capacity and enforces conditional priority updates', async () => {
    const r = (await create(await prospect(), { assignedUserId: member })).json();
    const paused = await mutate(
      r.id,
      'update',
      { status: 'paused', priority: 'critical' },
      admin,
      randomUUID(),
      r.etag,
    );
    expect(paused.statusCode, paused.body).toBe(200);
    expect(paused.json()).toMatchObject({ status: 'paused', priority: 'critical', endedAt: null });
    expect(
      (await mutate(r.id, 'update', { status: 'active' }, admin, randomUUID(), r.etag)).statusCode,
    ).toBe(412);
    const claim = await call(
      'POST',
      '/reservations/claim',
      { campaignId: campaign, campaignProspectId: r.campaignProspectId },
      member,
    );
    expect(claim.statusCode, claim.body).toBe(409);
    expect(
      (await mutate(r.id, 'update', { status: 'active' }, admin, randomUUID(), paused.json().etag))
        .statusCode,
    ).toBe(200);
    expect((await mutate(r.id, 'update', { status: 'completed' })).statusCode).toBe(400);
    expect((await mutate(r.id, 'update', {})).statusCode).toBe(400);
    expect((await mutate(r.id, 'update', { priority: null })).statusCode).toBe(400);
  });
  it('completes/revokes terminally, requires reasons, frees ownership and does not reopen history', async () => {
    const p = await prospect(),
      r = (await create(p)).json(),
      key = randomUUID();
    expect((await mutate(r.id, 'complete', { reason: ' ' })).statusCode).toBe(400);
    const ended = await mutate(r.id, 'complete', { reason: 'Work finished' }, admin, key, r.etag);
    expect(ended.statusCode, ended.body).toBe(200);
    expect(ended.json()).toMatchObject({ status: 'completed', endReason: 'Work finished' });
    expect(ended.json().endedAt).toBeTruthy();
    expect(
      (await mutate(r.id, 'complete', { reason: 'Work finished' }, admin, key, r.etag)).json(),
    ).toEqual(ended.json());
    expect((await mutate(r.id, 'update', { status: 'active' })).statusCode).toBe(409);
    expect((await mutate(r.id, 'revoke')).statusCode).toBe(409);
    const successor = await create(p);
    expect(successor.statusCode, successor.body).toBe(201);
    expect(
      (await mutate(successor.json().id, 'revoke', { reason: 'Allocated in error' })).json().status,
    ).toBe('revoked');
    await expect(
      db
        .update(campaignProspectAssignments)
        .set({ endedAt: null, status: 'active' })
        .where(eq(campaignProspectAssignments.id, r.id)),
    ).rejects.toThrow();
  });
  it('reassigns atomically with retained priority and scoped history', async () => {
    const p = await prospect(),
      r = (await create(p)).json();
    await mutate(r.id, 'update', { priority: 'high' });
    const next = await mutate(r.id, 'reassign', {
      teamId: otherTeam,
      reason: 'Regional workload balancing',
    });
    expect(next.statusCode, next.body).toBe(200);
    expect(next.json()).toMatchObject({ teamId: otherTeam, priority: 'high', status: 'active' });
    expect(next.json().id).not.toBe(r.id);
    const detail = (await call('GET', `/assignments/${r.id}`)).json();
    expect(detail.status).toBe('revoked');
    expect(detail.history).toHaveLength(2);
    expect(detail.events[0].action).toBe('assignment.reassign');
    const rows = await assignments();
    expect(rows.filter((r) => r.endedAt === null)).toHaveLength(1);
  });
  it('does not end the old assignment when a reassignment target is full or unauthorized', async () => {
    const r = (await create(await prospect())).json();
    await db
      .insert(teamSettings)
      .values({ tenantId, organizationId: org, teamId: otherTeam, capacity: 1 });
    await create(await prospect(), { teamId: otherTeam });
    expect(
      (await mutate(r.id, 'reassign', { teamId: otherTeam, reason: 'Move target' })).statusCode,
    ).toBe(409);
    expect((await call('GET', `/assignments/${r.id}`)).json().endedAt).toBeNull();
    expect(
      (await mutate(r.id, 'reassign', { teamId: team, reason: 'No ownership change' })).statusCode,
    ).toBe(409);
    expect(
      (await mutate(r.id, 'reassign', { teamId: outsideTeam, reason: 'Foreign organization' }))
        .statusCode,
    ).toBe(400);
  });
  it('limits reads/mutations to current grants and blocks cross-team managerial transfers', async () => {
    const r = (await create(await prospect(), { assignedUserId: member })).json();
    expect((await call('GET', `/assignments/${r.id}`, undefined, member)).statusCode).toBe(200);
    expect((await mutate(r.id, 'update', { priority: 'high' }, member)).statusCode).toBe(403);
    expect((await call('GET', `/assignments/${r.id}`, undefined, foreign)).statusCode).toBe(404);
    expect((await call('GET', '/assignments', undefined, foreign)).json().items).toHaveLength(0);
    expect(
      (await call('GET', `/assignments/unassigned?campaignId=${campaign}`, undefined, member))
        .statusCode,
    ).toBe(403);
    await db.insert(userAccessGrants).values({
      tenantId,
      userId: member,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    expect(
      (
        await call(
          'GET',
          `/assignments/unassigned?campaignId=${campaign}&teamId=${team}`,
          undefined,
          member,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await mutate(r.id, 'reassign', { teamId: otherTeam, reason: 'Unauthorized target' }, member))
        .statusCode,
    ).toBe(403);
    const next = (
      await mutate(r.id, 'reassign', { teamId: otherTeam, reason: 'Director transfer' }, director)
    ).json();
    expect((await call('GET', `/assignments/${next.id}`, undefined, member)).statusCode).toBe(404);
    const history = (await call('GET', `/assignments/${r.id}`, undefined, member)).json();
    expect(history.history).toHaveLength(1);
    expect(JSON.stringify(history.events)).not.toContain(otherTeam);
  });
  it('rechecks configurable permission before replay and after the tenant lock', async () => {
    const r = (await create(await prospect())).json(),
      key = randomUUID();
    expect((await mutate(r.id, 'update', { priority: 'high' }, director, key)).statusCode).toBe(
      200,
    );
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    expect((await mutate(r.id, 'update', { priority: 'high' }, director, key)).statusCode).toBe(
      403,
    );
    await db.delete(tenantRolePermissions).where(eq(tenantRolePermissions.tenantId, tenantId));
    const service = app.get(AssignmentLifecycleService),
      original = service.authorize.bind(service);
    let signal!: () => void;
    const checked = new Promise<void>((r) => (signal = r));
    vi.spyOn(service, 'authorize').mockImplementation(async (...args) => {
      const result = await original(...args);
      if (!args[2]) signal();
      return result;
    });
    let pending!: ReturnType<typeof mutate>;
    await db.transaction(async (tx) => {
      await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for('no key update');
      pending = mutate(r.id, 'complete', { reason: 'Race permission change' }, director);
      void pending.then(() => undefined);
      await checked;
      await tx
        .insert(tenantRolePermissions)
        .values({ tenantId, role: 'director', permissions: [] });
    });
    expect((await pending).statusCode).toBe(403);
    expect((await call('GET', `/assignments/${r.id}`)).json().endedAt).toBeNull();
  });
  it('serializes competing terminal decisions and records the winner once', async () => {
    const r = (await create(await prospect())).json();
    const race = await Promise.all([mutate(r.id, 'complete'), mutate(r.id, 'revoke')]);
    expect(race.map((x) => x.statusCode).sort()).toEqual([200, 409]);
    expect((await call('GET', `/assignments/${r.id}`)).json().events).toHaveLength(1);
  });
  it('retains legacy end semantics and blocks direct paused contact writes', async () => {
    const r = (await create(await prospect(), { assignedUserId: member })).json();
    await mutate(r.id, 'update', { status: 'paused' });
    const [p] = await db
      .select()
      .from(campaignProspects)
      .where(eq(campaignProspects.id, r.campaignProspectId));
    const result = await db.transaction(async (tx) => {
      try {
        await tx.execute(
          sql`INSERT INTO prospect_activities (tenant_id,campaign_id,campaign_prospect_id,establishment_id,assignment_id,user_id,type) VALUES (${tenantId},${campaign},${r.campaignProspectId},${p!.establishmentId},${r.id},${member},'call')`,
        );
        return 'unexpected';
      } catch (e) {
        return (e as { cause?: { code?: string } }).cause?.code;
      }
    });
    expect(result).toBe('PAA01');
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, r.id));
    expect((await call('GET', `/assignments/${r.id}`)).json()).toMatchObject({
      status: 'revoked',
      endReason: 'Legacy assignment ended',
    });
  });
});
