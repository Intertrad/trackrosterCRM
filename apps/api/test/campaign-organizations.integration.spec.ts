import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaignOrganizations,
  campaigns,
  identities,
  idempotencyRecords,
  membershipResourceScopes,
  organizations,
  teams,
  teamMemberships,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { CampaignOrganizationService } from '../src/campaign-organizations/campaign-organization.service.js';

describe('Campaign organization participation', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID();
  const admin = randomUUID(),
    director = randomUUID(),
    observer = randomUUID(),
    rosterMember = randomUUID(),
    foreign = randomUUID();
  const members = [admin, director, observer, rosterMember, foreign];
  const ownerOrg = randomUUID(),
    participantOrg = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID();
  const campaign = randomUUID(),
    foreignCampaign = randomUUID();
  const tokens = new Map<string, string>();
  const path = `/campaigns/${campaign}/organizations`;
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    body?: object,
    actor = admin,
    key: string = randomUUID(),
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload: body,
      headers: { authorization: `Bearer ${tokens.get(actor)}`, 'idempotency-key': key, ...headers },
    });
  const join = (
    mode = 'participate',
    org = participantOrg,
    actor = admin,
    key: string = randomUUID(),
  ) => call('POST', path, { organizationId: org, accessMode: mode }, actor, key);
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
    await db.insert(organizations).values(
      [ownerOrg, participantOrg, foreignOrg].map((id) => ({
        id,
        tenantId: id === foreignOrg ? foreignTenantId : tenantId,
        name: id,
        slug: id,
      })),
    );
    await db
      .insert(teams)
      .values({ id: team, tenantId, organizationId: participantOrg, name: team, slug: team });
    const password = 'CampaignOrganization123!';
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(members.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      members.map((id) => ({
        id,
        identityId: id,
        tenantId: id === foreign ? foreignTenantId : tenantId,
        status: 'active' as const,
        activatedAt: sql`now()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId, userId: admin, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenantId, userId: foreign, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId,
        userId: director,
        role: 'director',
        scopeType: 'organization',
        organizationId: participantOrg,
      },
      {
        tenantId,
        userId: observer,
        role: 'observer',
        scopeType: 'organization',
        organizationId: participantOrg,
      },
    ]);
    await db.insert(campaigns).values([
      { id: campaign, tenantId, organizationId: ownerOrg, name: campaign, status: 'active' },
      {
        id: foreignCampaign,
        tenantId: foreignTenantId,
        organizationId: foreignOrg,
        name: foreignCampaign,
        status: 'active',
      },
    ]);
    for (const id of members) {
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
    await db.delete(campaignOrganizations).where(eq(campaignOrganizations.tenantId, tenantId));
    await db.delete(teamMemberships).where(eq(teamMemberships.tenantId, tenantId));
    await db
      .delete(membershipResourceScopes)
      .where(eq(membershipResourceScopes.tenantId, tenantId));
    await db.update(campaigns).set({ status: 'active' }).where(eq(campaigns.id, campaign));
    await db
      .update(organizations)
      .set({ status: 'active' })
      .where(eq(organizations.id, participantOrg));
    await db.update(teams).set({ status: 'active' }).where(eq(teams.id, team));
    await db
      .update(tenantMemberships)
      .set({ status: 'active' })
      .where(eq(tenantMemberships.id, rosterMember));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      for (const t of [
        campaignOrganizations,
        teamMemberships,
        idempotencyRecords,
        auditEvents,
        membershipResourceScopes,
        campaigns,
        authSessions,
        userAccessGrants,
        tenantMemberships,
        teams,
        organizations,
      ])
        await db.delete(t).where(inArray(t.tenantId, ids));
      await db.delete(identities).where(inArray(identities.id, members));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  });
  it('validates tenant-local organizations, modes, ownership and scoped campaign visibility', async () => {
    expect((await call('GET', path, undefined, director)).statusCode).toBe(404);
    expect((await join('participate', foreignOrg)).statusCode).toBe(404);
    expect(
      (
        await call('POST', `/campaigns/${foreignCampaign}/organizations`, {
          organizationId: participantOrg,
        })
      ).statusCode,
    ).toBe(404);
    expect((await join('owner')).statusCode).toBe(400);
    expect((await join('participate', ownerOrg)).statusCode).toBe(409);
    expect((await call('DELETE', `${path}/${ownerOrg}`)).statusCode).toBe(409);
    expect(
      (await call('PATCH', `${path}/${ownerOrg}`, { accessMode: 'read_only' })).statusCode,
    ).toBe(409);
    expect((await join()).statusCode).toBe(201);
    const list = await call('GET', path);
    expect(list.json().owner).toEqual({ organizationId: ownerOrg, accessMode: 'owner' });
    expect(list.json().items).toHaveLength(1);
    expect((await call('GET', path, undefined, foreign)).statusCode).toBe(404);
    expect((await call('PATCH', `${path}/${participantOrg}`, {})).statusCode).toBe(400);
  });
  it('enforces live read-only and participant director access without campaign administration', async () => {
    await join('read_only');
    for (const actor of [director, observer]) {
      expect((await call('GET', `/campaigns/${campaign}`, undefined, actor)).statusCode).toBe(200);
      expect(
        (await call('GET', '/campaigns', undefined, actor)).json().map((r: { id: string }) => r.id),
      ).toContain(campaign);
      expect(
        (await call('PATCH', `/campaigns/${campaign}`, { name: 'Forbidden' }, actor)).statusCode,
      ).toBe(404);
    }
    expect(
      (await call('PATCH', `${path}/${participantOrg}`, { accessMode: 'participate' })).statusCode,
    ).toBe(200);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Participant edit' }, director))
        .statusCode,
    ).toBe(200);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Observer edit' }, observer))
        .statusCode,
    ).toBe(404);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { status: 'paused' }, director)).statusCode,
    ).toBe(404);
    expect((await join('read_only', participantOrg, director)).statusCode).toBe(404);
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/members`,
          { membershipId: rosterMember },
          director,
        )
      ).statusCode,
    ).toBe(404);
    const permissions = (await call('GET', '/me/permissions', undefined, director)).json();
    expect(JSON.stringify(permissions)).toContain('campaign_organization');
    expect(JSON.stringify(permissions)).toContain('read_write');
    await call('DELETE', `${path}/${participantOrg}`);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, director)).statusCode).toBe(404);
  });
  it('inherits only read access through live team rosters and explicit team grants', async () => {
    await join();
    await db.insert(teamMemberships).values({
      tenantId,
      teamId: team,
      membershipId: rosterMember,
      startsAt: new Date(Date.now() + 3600000),
    });
    expect((await call('GET', `/campaigns/${campaign}`, undefined, rosterMember)).statusCode).toBe(
      404,
    );
    await db
      .update(teamMemberships)
      .set({ startsAt: new Date(Date.now() - 3600000) })
      .where(eq(teamMemberships.membershipId, rosterMember));
    expect((await call('GET', `/campaigns/${campaign}`, undefined, rosterMember)).statusCode).toBe(
      200,
    );
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'No' }, rosterMember)).statusCode,
    ).toBe(404);
    await db
      .update(teamMemberships)
      .set({ endsAt: new Date(Date.now() - 1000) })
      .where(eq(teamMemberships.membershipId, rosterMember));
    expect((await call('GET', `/campaigns/${campaign}`, undefined, rosterMember)).statusCode).toBe(
      404,
    );
    const [grant] = await db
      .insert(userAccessGrants)
      .values({
        tenantId,
        userId: rosterMember,
        role: 'prospector',
        scopeType: 'team',
        organizationId: participantOrg,
        teamId: team,
      })
      .returning();
    try {
      expect(
        (await call('GET', `/campaigns/${campaign}`, undefined, rosterMember)).statusCode,
      ).toBe(200);
      await db.update(teams).set({ status: 'inactive' }).where(eq(teams.id, team));
      expect(
        (await call('GET', `/campaigns/${campaign}`, undefined, rosterMember)).statusCode,
      ).toBe(404);
    } finally {
      await db.delete(userAccessGrants).where(eq(userAccessGrants.id, grant!.id));
    }
  });
  it('blocks cached campaign edits after a mode downgrade and resolves organization grant revocation live', async () => {
    await join();
    const key = randomUUID();
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Allowed once' }, director, key))
        .statusCode,
    ).toBe(200);
    await call('PATCH', `${path}/${participantOrg}`, { accessMode: 'read_only' });
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Allowed once' }, director, key))
        .statusCode,
    ).toBe(404);
    const [grant] = await db
      .select()
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.userId, director),
          eq(userAccessGrants.organizationId, participantOrg),
        ),
      );
    await db.delete(userAccessGrants).where(eq(userAccessGrants.id, grant!.id));
    try {
      expect((await call('GET', `/campaigns/${campaign}`, undefined, director)).statusCode).toBe(
        404,
      );
      expect(
        JSON.stringify((await call('GET', '/me/permissions', undefined, director)).json()),
      ).not.toContain('campaign_organization');
    } finally {
      await db.insert(userAccessGrants).values(grant!);
    }
  });
  it('retains history and audit evidence, with ETags and cursor pagination', async () => {
    const created = await join();
    const oldId = created.json().id;
    expect(
      (
        await call(
          'PATCH',
          `${path}/${participantOrg}`,
          { accessMode: 'read_only' },
          admin,
          randomUUID(),
          { 'if-match': '"stale"' },
        )
      ).statusCode,
    ).toBe(412);
    const changed = await call(
      'PATCH',
      `${path}/${participantOrg}`,
      { accessMode: 'read_only' },
      admin,
      randomUUID(),
      { 'if-match': String(created.headers.etag) },
    );
    expect(changed.statusCode).toBe(200);
    expect(
      (
        await call('DELETE', `${path}/${participantOrg}`, undefined, admin, randomUUID(), {
          'if-match': String(created.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    expect(
      (
        await call('DELETE', `${path}/${participantOrg}`, undefined, admin, randomUUID(), {
          'if-match': String(changed.headers.etag),
        })
      ).statusCode,
    ).toBe(204);
    const rejoined = await join();
    expect(rejoined.json().id).not.toBe(oldId);
    expect((await call('GET', `${path}?state=ended`)).json().items[0].id).toBe(oldId);
    const first = (await call('GET', `${path}?state=all&limit=1`)).json();
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await call('GET', `${path}?state=all&limit=1&cursor=${first.nextCursor}`)
    ).json();
    expect(second.items[0].id).not.toBe(first.items[0].id);
    const audit = await db.select().from(auditEvents).where(eq(auditEvents.resourceId, oldId));
    expect(audit.map((r) => r.action).sort()).toEqual([
      'campaign_organization.created',
      'campaign_organization.ended',
      'campaign_organization.updated',
    ]);
  });
  it('rejects concurrent duplicates and enforces tenant-safe database constraints', async () => {
    const race = await Promise.all([join(), join()]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await expect(
      db
        .insert(campaignOrganizations)
        .values({ tenantId, campaignId: campaign, organizationId: participantOrg }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(
      db
        .insert(campaignOrganizations)
        .values({ tenantId, campaignId: campaign, organizationId: foreignOrg }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(
      db
        .insert(campaignOrganizations)
        .values({ tenantId, campaignId: foreignCampaign, organizationId: participantOrg }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('blocks inactive subjects and terminal campaign edits while allowing removal', async () => {
    await db
      .update(organizations)
      .set({ status: 'inactive' })
      .where(eq(organizations.id, participantOrg));
    expect((await join()).statusCode).toBe(409);
    await db
      .update(organizations)
      .set({ status: 'active' })
      .where(eq(organizations.id, participantOrg));
    await join();
    for (const status of ['completed', 'archived'] as const) {
      await db.update(campaigns).set({ status }).where(eq(campaigns.id, campaign));
      expect(
        (await call('PATCH', `${path}/${participantOrg}`, { accessMode: 'read_only' })).statusCode,
      ).toBe(409);
    }
    expect((await call('GET', `/campaigns/${campaign}`, undefined, director)).statusCode).toBe(404);
    expect((await call('DELETE', `${path}/${participantOrg}`)).statusCode).toBe(204);
    expect((await join()).statusCode).toBe(409);
  });
  it('keeps explicit resource grants independent of organization participation', async () => {
    await join();
    await db.insert(membershipResourceScopes).values({
      tenantId,
      userId: director,
      role: 'director',
      scopeType: 'campaign',
      campaignId: campaign,
      accessLevel: 'read',
    });
    await call('DELETE', `${path}/${participantOrg}`);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, director)).statusCode).toBe(200);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'No' }, director)).statusCode,
    ).toBe(404);
  });
  it('rechecks permissions before idempotent replay and after waiting for a mutation lock', async () => {
    const [grant] = await db
      .insert(membershipResourceScopes)
      .values({
        tenantId,
        userId: director,
        role: 'director',
        scopeType: 'campaign',
        campaignId: campaign,
        accessLevel: 'manage',
      })
      .returning();
    const key = randomUUID();
    const first = await join('participate', participantOrg, director, key);
    expect(first.statusCode).toBe(201);
    expect((await join('participate', participantOrg, director, key)).json().id).toBe(
      first.json().id,
    );
    await db.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, grant!.id));
    expect((await join('participate', participantOrg, director, key)).statusCode).toBe(404);
    await db.insert(membershipResourceScopes).values(grant!);
    const service = app.get(CampaignOrganizationService);
    const original = service.authorize.bind(service);
    let signal!: () => void;
    const checked = new Promise<void>((r) => {
      signal = r;
    });
    vi.spyOn(service, 'authorize').mockImplementation(async (...args) => {
      await original(...args);
      if (!args[2]) signal();
    });
    let pending!: ReturnType<typeof call>;
    await db.transaction(async (tx) => {
      await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for('no key update');
      pending = call('PATCH', `${path}/${participantOrg}`, { accessMode: 'read_only' }, director);
      void pending.then(() => undefined);
      await checked;
      await tx.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, grant!.id));
    });
    expect((await pending).statusCode).toBe(404);
    const [row] = await db
      .select()
      .from(campaignOrganizations)
      .where(
        and(
          eq(campaignOrganizations.tenantId, tenantId),
          eq(campaignOrganizations.organizationId, participantOrg),
        ),
      );
    expect(row!.accessMode).toBe('participate');
  });
  it('protects organization deactivation including concurrent participation creation', async () => {
    const org = randomUUID();
    await db.insert(organizations).values({ id: org, tenantId, name: org, slug: org });
    await join('participate', org);
    expect((await call('DELETE', `/organizations/${org}`)).statusCode).toBe(409);
    await call('DELETE', `${path}/${org}`);
    expect((await call('DELETE', `/organizations/${org}`)).statusCode).toBe(200);
    const other = randomUUID();
    await db.insert(organizations).values({ id: other, tenantId, name: other, slug: other });
    const race = await Promise.all([
      join('participate', other),
      call('DELETE', `/organizations/${other}`),
    ]);
    expect(race.filter((r) => r.statusCode === 409)).toHaveLength(1);
  });
});
