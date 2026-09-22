import { CampaignProspectAssignmentService } from '../src/assignments/campaign-prospect-assignment.service.js';
import { TeamRepository } from '../src/teams/team.repository.js';
import { campaigns, campaignProspects, establishments } from '../src/database/schema/index.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  idempotencyRecords,
  organizations,
  teams,
  tenants,
  users,
  userAccessGrants,
  teamSettings,
} from '../src/database/schema/index.js';
import { UserRepository } from '../src/users/user.repository.js';
import { AccessGrantService } from '../src/authorization/access-grant.service.js';

describe('Workspace administration HTTP authorization and persistence', () => {
  let app: NestFastifyApplication;
  let db: Database;
  const tenantId = randomUUID(),
    otherTenantId = randomUUID();
  const orgId = randomUUID(),
    hiddenOrgId = randomUUID(),
    teamId = randomUUID(),
    hiddenTeamId = randomUUID();
  const adminId = randomUUID(),
    managerId = randomUUID(),
    prospectorId = randomUUID(),
    otherAdminId = randomUUID();
  const adminGrantId = randomUUID();
  const password = 'AdminIntegrationPassword123!';
  const tokens = new Map<string, string>();

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = app.get(DATABASE);
    await db
      .insert(tenants)
      .values([tenantId, otherTenantId].map((id) => ({ id, name: id, slug: id })));
    await db
      .insert(organizations)
      .values([orgId, hiddenOrgId].map((id) => ({ id, tenantId, name: id, slug: id })));
    await db.insert(teams).values([
      { id: teamId, tenantId, organizationId: orgId, name: 'Managed team', slug: 'managed' },
      {
        id: hiddenTeamId,
        tenantId,
        organizationId: hiddenOrgId,
        name: 'Other team',
        slug: 'other',
      },
    ]);
    const passwordHash = await app.get(PasswordService).hash(password);
    await db.insert(users).values(
      [adminId, managerId, prospectorId, otherAdminId].map((id) => ({
        id,
        tenantId: id === otherAdminId ? otherTenantId : tenantId,
        email: `${id}@example.test`,
        passwordHash,
      })),
    );
    await db.insert(userAccessGrants).values([
      { id: adminGrantId, tenantId, userId: adminId, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: otherTenantId, userId: otherAdminId, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId,
        userId: managerId,
        role: 'manager',
        scopeType: 'team',
        organizationId: orgId,
        teamId,
      },
      {
        tenantId,
        userId: prospectorId,
        role: 'prospector',
        scopeType: 'team',
        organizationId: orgId,
        teamId,
      },
    ]);
    for (const id of [adminId, managerId, prospectorId, otherAdminId]) {
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(login.statusCode).toBe(200);
      tokens.set(id, login.json().accessToken);
    }
  });

  afterAll(async () => {
    if (db) {
      const ids = [tenantId, otherTenantId];
      await db.delete(idempotencyRecords).where(inArray(idempotencyRecords.tenantId, ids));
      await db.delete(auditEvents).where(inArray(auditEvents.tenantId, ids));
      await db.delete(teamSettings).where(inArray(teamSettings.tenantId, ids));
      await db.delete(userAccessGrants).where(inArray(userAccessGrants.tenantId, ids));
      await db.delete(users).where(inArray(users.tenantId, ids));
      await db.delete(teams).where(inArray(teams.tenantId, ids));
      await db.delete(organizations).where(inArray(organizations.tenantId, ids));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  });

  const headers = (id = adminId) => ({
    authorization: `Bearer ${tokens.get(id)}`,
    'idempotency-key': randomUUID(),
  });

  it('derives tenant from authentication and denies reader configuration writes', async () => {
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/v1/tenant',
      headers: headers(),
      payload: { name: 'Configured workspace', locale: 'fr', timezone: 'Europe/Paris' },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ id: tenantId, locale: 'fr', timezone: 'Europe/Paris' });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/v1/tenant',
          headers: headers(managerId),
          payload: { name: 'Forbidden' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/v1/tenant',
          headers: headers(),
          payload: { tenantId: otherTenantId },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({ method: 'GET', url: '/api/v1/tenant', headers: headers(otherAdminId) })
      ).json().name,
    ).toBe(otherTenantId);
  });

  it('paginates stable organization lists and filters to the current scope', async () => {
    const first = (
      await app.inject({ method: 'GET', url: '/api/v1/organizations?limit=1', headers: headers() })
    ).json();
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await app.inject({
        method: 'GET',
        url: `/api/v1/organizations?limit=1&cursor=${first.nextCursor}`,
        headers: headers(),
      })
    ).json();
    expect(second.items).toHaveLength(1);
    expect(first.items[0].id).not.toBe(second.items[0].id);
    const scoped = (
      await app.inject({ method: 'GET', url: '/api/v1/organizations', headers: headers(managerId) })
    ).json();
    expect(scoped.items.map((row: { id: string }) => row.id)).toEqual([orgId]);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${hiddenOrgId}`,
          headers: headers(managerId),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}`,
          headers: headers(otherAdminId),
        })
      ).statusCode,
    ).toBe(404);
  });

  it('persists, audits and replays organization creation without duplicate writes', async () => {
    const h = headers(),
      payload = { name: 'New organization', slug: 'new-organization' };
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: h,
      payload,
    });
    expect(created.statusCode).toBe(201);
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: h,
      payload,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(created.json().id);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: headers(),
          payload,
        })
      ).statusCode,
    ).toBe(409);
    const evidence = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, created.json().id));
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.actorUserId).toBe(adminId);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/organizations/${created.json().id}`,
          headers: headers(),
        })
      ).json().status,
    ).toBe('inactive');
  });

  it('rejects deactivating organizations with active teams', async () => {
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/organizations/${orgId}`,
          headers: headers(),
        })
      ).statusCode,
    ).toBe(409);
  });

  it('allows managers to update only their team and prevents privilege changes', async () => {
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: headers(managerId),
      payload: { capacity: 42, name: 'Updated team' },
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({ capacity: 42, name: 'Updated team' });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${hiddenTeamId}`,
          headers: headers(managerId),
          payload: { capacity: 1 },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${teamId}`,
          headers: headers(prospectorId),
          payload: { capacity: 1 },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${teamId}`,
          headers: headers(managerId),
          payload: { managerMembershipId: managerId },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${teamId}`,
          headers: headers(),
          payload: { managerMembershipId: otherAdminId },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/teams/${teamId}/capacity`,
          headers: headers(managerId),
        })
      ).json(),
    ).toMatchObject({ capacity: 42, assigned: 0, available: 42 });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/teams/${teamId}/capacity`,
          headers: headers(prospectorId),
        })
      ).statusCode,
    ).toBe(403);
  });

  it('creates and deactivates teams with validated capacity', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/teams',
      headers: headers(),
      payload: {
        name: 'New team',
        slug: 'new-team',
        organizationId: orgId,
        capacity: 12,
        managerMembershipId: managerId,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ capacity: 12, managerMembershipId: managerId });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/teams/${created.json().id}`,
          headers: headers(managerId),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/teams',
          headers: headers(),
          payload: { name: 'Bad', slug: 'bad', organizationId: orgId, capacity: -1 },
        })
      ).statusCode,
    ).toBe(400);
    const managerHeaders = headers(managerId);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${created.json().id}`,
          headers: managerHeaders,
          payload: { capacity: 13 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${created.json().id}`,
          headers: headers(),
          payload: { managerMembershipId: null },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/teams/${created.json().id}`,
          headers: managerHeaders,
          payload: { capacity: 13 },
        })
      ).statusCode,
    ).toBe(404);
    const ended = await app.inject({
      method: 'DELETE',
      url: `/api/v1/teams/${created.json().id}`,
      headers: headers(),
    });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().status).toBe('inactive');
  });

  it('rejects an assignment whose team is deactivated after its initial validation', async () => {
    const raceTeamId = randomUUID(),
      campaignId = randomUUID(),
      establishmentId = randomUUID(),
      prospectId = randomUUID();
    await db.insert(teams).values({
      id: raceTeamId,
      tenantId,
      organizationId: orgId,
      name: 'Race team',
      slug: raceTeamId,
    });
    await db
      .insert(campaigns)
      .values({ id: campaignId, tenantId, organizationId: orgId, name: 'Race campaign' });
    await db.insert(establishments).values({
      id: establishmentId,
      tenantId,
      name: 'Race prospect',
      normalizedName: 'race prospect',
      source: 'manual',
      countryCode: 'FR',
    });
    await db
      .insert(campaignProspects)
      .values({ id: prospectId, tenantId, campaignId, establishmentId });
    let releaseValidation!: () => void, sawValidation!: () => void;
    const validated = new Promise<void>((resolve) => {
      sawValidation = resolve;
    });
    const pause = new Promise<void>((resolve) => {
      releaseValidation = resolve;
    });
    const repository = app.get(TeamRepository),
      original = repository.findById.bind(repository);
    const spy = vi.spyOn(repository, 'findById').mockImplementation(async (tenant, id) => {
      const team = await original(tenant, id);
      if (id === raceTeamId) {
        sawValidation();
        await pause;
      }
      return team;
    });
    try {
      const pending = app.get(CampaignProspectAssignmentService).assign({
        tenantId,
        actorUserId: adminId,
        campaignId,
        campaignProspectId: prospectId,
        teamId: raceTeamId,
      });
      const assertion = expect(pending).rejects.toThrow('Team is not active');
      await validated;
      const deactivated = await app.inject({
        method: 'DELETE',
        url: `/api/v1/teams/${raceTeamId}`,
        headers: headers(),
      });
      expect(deactivated.statusCode).toBe(200);
      releaseValidation();
      await assertion;
    } finally {
      releaseValidation();
      spy.mockRestore();
      await db.delete(campaignProspects).where(eq(campaignProspects.id, prospectId));
      await db.delete(campaigns).where(eq(campaigns.id, campaignId));
      await db.delete(establishments).where(eq(establishments.id, establishmentId));
      await db.delete(teams).where(eq(teams.id, raceTeamId));
    }
  });

  it('prevents removal or suspension of the last administrator', async () => {
    await expect(
      app.get(UserRepository).updateStatus(tenantId, adminId, 'suspended'),
    ).rejects.toThrow('last active tenant administrator');
    await expect(
      app
        .get(AccessGrantService)
        .revoke({ tenantId, actorUserId: adminId, userId: adminId, grantId: adminGrantId }),
    ).rejects.toThrow('last active tenant administrator');
  });

  it('rejects stale edits and binds idempotency to the supplied resource version', async () => {
    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}`,
      headers: headers(),
    });
    const h = { ...headers(), 'if-match': String(before.headers.etag) };
    const update = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: h,
      payload: { capacity: 51 },
    });
    expect(update.statusCode).toBe(200);
    expect(update.headers.etag).not.toBe(before.headers.etag);
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { ...headers(), 'if-match': String(before.headers.etag) },
      payload: { capacity: 52 },
    });
    expect(stale.statusCode).toBe(412);
    expect(stale.json().code).toBe('RESOURCE_VERSION_CONFLICT');
    const replay = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: h,
      payload: { capacity: 51 },
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers.etag).toBe(update.headers.etag);
    const changedCondition = await app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${teamId}`,
      headers: { ...h, 'if-match': String(update.headers.etag) },
      payload: { capacity: 51 },
    });
    expect(changedCondition.statusCode).toBe(409);
  });

  it('checks current authorization before replaying a privileged mutation', async () => {
    const [grant] = await db
      .insert(userAccessGrants)
      .values({ tenantId, userId: managerId, role: 'client_admin', scopeType: 'tenant' })
      .returning();
    try {
      const h = headers(managerId),
        payload = { name: 'Admin-authorized change' };
      const first = await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant',
        headers: h,
        payload,
      });
      expect(first.statusCode).toBe(200);
      await app
        .get(AccessGrantService)
        .revoke({ tenantId, actorUserId: adminId, userId: managerId, grantId: grant!.id });
      const replay = await app.inject({
        method: 'PATCH',
        url: '/api/v1/tenant',
        headers: h,
        payload,
      });
      expect(replay.statusCode).toBe(403);
    } finally {
      await db.delete(userAccessGrants).where(eq(userAccessGrants.id, grant!.id));
    }
  });

  it('serializes concurrent administrator suspensions so one remains active', async () => {
    const secondGrant = await db
      .insert(userAccessGrants)
      .values({ tenantId, userId: managerId, role: 'client_admin', scopeType: 'tenant' })
      .returning();
    try {
      const results = await Promise.allSettled(
        [adminId, managerId].map((id) =>
          app.get(UserRepository).updateStatus(tenantId, id, 'suspended'),
        ),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    } finally {
      await app.get(UserRepository).updateStatus(tenantId, adminId, 'active');
      await app.get(UserRepository).updateStatus(tenantId, managerId, 'active');
      await db.delete(userAccessGrants).where(eq(userAccessGrants.id, secondGrant[0]!.id));
    }
  });
});
