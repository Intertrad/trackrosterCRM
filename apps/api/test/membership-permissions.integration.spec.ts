import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  organizations,
  teams,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { MembershipService } from '../src/memberships/membership.service.js';
import type { AuthenticatedPrincipal } from '../src/auth/auth.types.js';

describe('Membership administration and enforced role permissions', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID();
  const adminId = randomUUID(),
    secondAdminId = randomUUID(),
    managerId = randomUUID(),
    prospectorId = randomUUID(),
    foreignId = randomUUID();
  const ids: string[] = [adminId, secondAdminId, managerId, prospectorId, foreignId];
  const orgId = randomUUID(),
    otherOrgId = randomUUID(),
    foreignOrgId = randomUUID(),
    teamId = randomUUID();
  const campaignId = randomUUID(),
    prospects = [randomUUID(), randomUUID(), randomUUID()];
  const password = 'MembershipPassword123!';
  const tokens = new Map<string, string>();
  let replayKey: string, prospectorGrantId: string;
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    body?: object,
    actor = adminId,
    key: string = randomUUID(),
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload: body,
      headers: { authorization: `Bearer ${tokens.get(actor)}`, 'idempotency-key': key, ...headers },
    });
  const login = async (id: string) => {
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: `${id}@example.test`, password },
    });
    expect(result.statusCode).toBe(200);
    tokens.set(id, result.json().accessToken);
  };
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = app.get(DATABASE);
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values(
      [orgId, otherOrgId, foreignOrgId].map((id) => ({
        id,
        tenantId: id === foreignOrgId ? foreignTenantId : tenantId,
        name: id,
        slug: id,
      })),
    );
    await db
      .insert(teams)
      .values({ id: teamId, tenantId, organizationId: orgId, name: 'Team', slug: 'team' });
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(ids.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      ids.map((id) => ({
        id,
        tenantId: id === foreignId ? foreignTenantId : tenantId,
        identityId: id,
        status: 'active' as const,
        activatedAt: sql`clock_timestamp()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId, userId: adminId, role: 'client_admin', scopeType: 'tenant' },
      { tenantId, userId: secondAdminId, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenantId, userId: foreignId, role: 'client_admin', scopeType: 'tenant' },
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
        userId: managerId,
        role: 'director',
        scopeType: 'organization',
        organizationId: otherOrgId,
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
    prospectorGrantId = (
      await db.select().from(userAccessGrants).where(eq(userAccessGrants.userId, prospectorId))
    )[0]!.id;
    await db.insert(campaigns).values({
      id: campaignId,
      tenantId,
      organizationId: orgId,
      name: 'Membership assignments',
      status: 'active',
    });
    await db
      .insert(establishments)
      .values(
        prospects.map((id) => ({ id, tenantId, name: id, normalizedName: id, countryCode: 'FR' })),
      );
    await db.insert(campaignProspects).values(
      prospects.map((id) => ({
        id,
        tenantId,
        campaignId,
        establishmentId: id,
        organizationId: orgId,
      })),
    );
    for (const id of ids) await login(id);
  });
  afterAll(async () => {
    if (db) {
      const tenantIds = [tenantId, foreignTenantId];
      await db.delete(idempotencyRecords).where(inArray(idempotencyRecords.tenantId, tenantIds));
      await db.delete(auditEvents).where(inArray(auditEvents.tenantId, tenantIds));
      await db
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.tenantId, tenantId));
      await db.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));
      await db.delete(campaigns).where(eq(campaigns.tenantId, tenantId));
      await db.delete(establishments).where(eq(establishments.tenantId, tenantId));
      await db.delete(authSessions).where(inArray(authSessions.tenantId, tenantIds));
      await db.delete(userAccessGrants).where(inArray(userAccessGrants.tenantId, tenantIds));
      await db.delete(tenantMemberships).where(inArray(tenantMemberships.tenantId, tenantIds));
      await db.delete(identities).where(inArray(identities.id, ids));
      await db.delete(teams).where(eq(teams.tenantId, tenantId));
      await db.delete(organizations).where(inArray(organizations.tenantId, tenantIds));
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    }
    await app?.close();
  });
  it('lists only this tenant, supports scope/role filters, and paginates without duplicates', async () => {
    expect((await call('GET', '/memberships', undefined, managerId)).statusCode).toBe(403);
    const page = await call('GET', '/memberships?limit=2');
    expect(page.statusCode).toBe(200);
    expect(page.json().items).toHaveLength(2);
    const next = await call('GET', `/memberships?limit=2&cursor=${page.json().nextCursor}`);
    expect(
      new Set([...page.json().items, ...next.json().items].map((item: { id: string }) => item.id))
        .size,
    ).toBe(4);
    const filtered = await call('GET', `/memberships?role=prospector&teamId=${teamId}`);
    expect(filtered.json().items.map((item: { id: string }) => item.id)).toEqual([prospectorId]);
    expect((await call('GET', `/memberships/${foreignId}`)).statusCode).toBe(404);
  });
  it('updates capacity with optimistic concurrency and reports scoped effective permissions', async () => {
    const before = await call('GET', `/memberships/${prospectorId}`);
    const changed = await call(
      'PATCH',
      `/memberships/${prospectorId}`,
      { capacity: 1 },
      adminId,
      randomUUID(),
      { 'if-match': String(before.headers.etag) },
    );
    expect(changed.statusCode).toBe(200);
    expect(changed.json().availableCapacity).toBe(1);
    expect(changed.json().scopes[0].permissions).toContain('scope.read');
    expect(
      (
        await call(
          'PATCH',
          `/memberships/${prospectorId}`,
          { capacity: 2 },
          adminId,
          randomUUID(),
          { 'if-match': String(before.headers.etag) },
        )
      ).statusCode,
    ).toBe(412);
  });
  it('serializes concurrent assignments against membership capacity and protects active scope', async () => {
    const results = await Promise.all(
      prospects.slice(0, 2).map((id) =>
        call('POST', `/campaigns/${campaignId}/prospects/${id}/assignment`, {
          teamId,
          assignedUserId: prospectorId,
        }),
      ),
    );
    expect(results.map((row) => row.statusCode).sort()).toEqual([201, 409]);
    expect((await call('PATCH', `/memberships/${prospectorId}`, { capacity: 0 })).statusCode).toBe(
      409,
    );
    expect((await call('DELETE', `/membership-scopes/${prospectorGrantId}`)).statusCode).toBe(409);
    expect(
      (
        await call('PATCH', `/memberships/${prospectorId}`, {
          role: 'auditor',
          reason: 'Role change requested',
        })
      ).statusCode,
    ).toBe(409);
  });
  it('suspends only a membership, revokes its sessions, and permits explicit reactivation', async () => {
    expect(
      (await call('POST', `/memberships/${prospectorId}/suspend`, { reason: 'Temporary leave' }))
        .statusCode,
    ).toBe(200);
    expect((await call('GET', '/me', undefined, prospectorId)).statusCode).toBe(401);
    expect(
      (await db.select().from(identities).where(eq(identities.id, prospectorId)))[0]!.status,
    ).toBe('active');
    expect(
      (
        await call('POST', `/memberships/${prospectorId}/reactivate`, {
          reason: 'Returned to work',
        })
      ).statusCode,
    ).toBe(200);
    expect((await call('GET', '/me', undefined, prospectorId)).statusCode).toBe(401);
    await login(prospectorId);
  });
  it('validates tenant scope, rejects duplicates and retains history after scope removal', async () => {
    expect(
      (
        await call('POST', `/memberships/${prospectorId}/scopes`, {
          role: 'auditor',
          scopeType: 'organization',
          organizationId: foreignOrgId,
        })
      ).statusCode,
    ).toBe(404);
    const input = { role: 'auditor', scopeType: 'organization', organizationId: otherOrgId };
    const added = await call('POST', `/memberships/${prospectorId}/scopes`, input);
    expect(added.statusCode).toBe(201);
    expect((await call('POST', `/memberships/${prospectorId}/scopes`, input)).statusCode).toBe(409);
    const grants = (await call('GET', `/memberships/${prospectorId}/scopes`)).json();
    const scope = grants.find((g: { id: string }) => g.id === added.json().id);
    expect(
      (
        await call(
          'PATCH',
          `/membership-scopes/${scope.id}`,
          { role: 'auditor', scopeType: 'tenant' },
          adminId,
          randomUUID(),
          { 'if-match': scope.etag },
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('DELETE', `/membership-scopes/${scope.id}`, undefined, adminId, randomUUID(), {
          'if-match': scope.etag,
        })
      ).statusCode,
    ).toBe(412);
    expect((await call('DELETE', `/membership-scopes/${scope.id}`)).statusCode).toBe(204);
    const history = (
      await call('GET', `/memberships/${prospectorId}/access-history?limit=2`)
    ).json();
    expect(history.items).toHaveLength(2);
    expect(history.nextCursor).toBeTypeOf('string');
    expect(
      (await call('GET', `/memberships/${prospectorId}/access-history`, undefined, foreignId))
        .statusCode,
    ).toBe(404);
    const all = (await call('GET', `/memberships/${prospectorId}/access-history`)).json().items;
    expect(all.map((event: { action: string }) => event.action)).toContain(
      'membership.scope_removed',
    );
    expect(all.map((event: { action: string }) => event.action)).toContain(
      'membership.scope_added',
    );
  });
  it('preserves access evidence after audit retention and rejects database tampering', async () => {
    const eventId = randomUUID();
    await db.insert(auditEvents).values({
      id: eventId,
      tenantId,
      actorType: 'user',
      actorUserId: adminId,
      action: 'membership.evidence_test',
      resourceType: 'tenant_membership',
      resourceId: prospectorId,
      metadata: { reason: 'Evidence test' },
    });
    for (const statement of [
      sql`UPDATE membership_access_evidence SET digest='invalid' WHERE id=${eventId}`,
      sql`DELETE FROM membership_access_evidence WHERE id=${eventId}`,
      sql`TRUNCATE membership_access_evidence`,
      sql`INSERT INTO membership_access_evidence SELECT ${randomUUID()}::uuid,tenant_id,membership_id,payload,digest,occurred_at FROM membership_access_evidence WHERE id=${eventId}`,
    ])
      await expect(db.execute(statement)).rejects.toThrow();
    await db.delete(auditEvents).where(eq(auditEvents.id, eventId));
    const history = await call('GET', `/memberships/${prospectorId}/access-history`);
    expect(history.statusCode).toBe(200);
    expect(history.json().items.find((item: { id: string }) => item.id === eventId)).toMatchObject({
      action: 'membership.evidence_test',
      integrity: { algorithm: 'sha256', verified: true },
    });
  });

  it('exposes six roles and prevents privilege expansion through role configuration', async () => {
    expect((await call('GET', '/roles')).json().items).toHaveLength(6);
    expect((await call('GET', '/permissions')).json().items.length).toBeGreaterThan(4);
    expect(
      (await call('PUT', '/roles/tenant_admin/permissions', { permissions: [] })).statusCode,
    ).toBe(403);
    expect(
      (await call('PUT', '/roles/super_admin/permissions', { permissions: [] })).statusCode,
    ).toBe(403);
    expect(
      (await call('PUT', '/roles/prospector/permissions', { permissions: ['memberships.manage'] }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call('PUT', '/roles/manager/permissions', { permissions: [] }, managerId)).statusCode,
    ).toBe(403);
  });
  it('enforces permission revocation before idempotent replay, including mixed roles in unrelated scopes', async () => {
    replayKey = randomUUID();
    const url = `/campaigns/${campaignId}/prospects/${prospects[2]}/assignment`;
    expect((await call('POST', url, { teamId }, managerId, replayKey)).statusCode).toBe(201);
    const changed = await call('PUT', '/roles/manager/permissions', { permissions: [] });
    expect(changed.statusCode).toBe(200);
    expect((await call('POST', url, { teamId }, managerId, replayKey)).statusCode).toBe(403);
    expect(
      (await call('PATCH', `/teams/${teamId}`, { name: 'Must fail' }, managerId)).statusCode,
    ).toBe(403);
    expect(
      (await call('GET', `/exports/assignments?teamId=${teamId}`, undefined, managerId)).statusCode,
    ).toBe(403);
    const own = (await call('GET', '/me/permissions', undefined, managerId)).json();
    expect(own.find((g: { role: string }) => g.role === 'manager').permissions).not.toContain(
      'assignments.manage',
    );
    const history = (await call('GET', `/memberships/${managerId}/access-history`)).json();
    expect(
      history.items.some(
        (event: { action: string }) => event.action === 'membership.permissions_updated',
      ),
    ).toBe(true);
    expect(
      (await call('PATCH', `/teams/${teamId}`, { name: 'Admin retains management' })).statusCode,
    ).toBe(200);
  });
  it('supports wider role restrictions without granting resource authority', async () => {
    const catalogue = (await call('GET', '/permissions')).json().items;
    expect(catalogue.map((p: { permission: string }) => p.permission)).toEqual(
      expect.arrayContaining([
        'campaigns.read',
        'routes.manage',
        'reports.read',
        'imports.manage',
        'consents.manage',
      ]),
    );
    const defaults = (await call('GET', '/roles/prospector/permissions')).json()
      .configurablePermissions as string[];
    const result = await call('PUT', '/roles/prospector/permissions', {
      permissions: defaults.filter((p) => p !== 'notifications.read'),
    });
    expect(result.statusCode).toBe(200);
    expect((await call('GET', '/notifications', undefined, prospectorId)).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/notifications',
          headers: { authorization: `Bearer ${tokens.get(prospectorId)}` },
        })
      ).statusCode,
    ).toBe(403);
    expect((await call('GET', '/notifications')).statusCode).toBe(200);
    expect(
      (await call('PUT', '/roles/prospector/permissions', { permissions: defaults })).statusCode,
    ).toBe(200);
    expect((await call('GET', '/notifications', undefined, prospectorId)).statusCode).toBe(200);
  });
  it('gives explicit denials precedence, rejects foreign targets and audits removal', async () => {
    const input = {
      effect: 'deny',
      scopeType: 'team',
      teamId,
      reason: 'Restricted team information',
    };
    expect((await call('POST', `/memberships/${adminId}/scopes`, input)).statusCode).toBe(409);
    expect(
      (
        await call('POST', `/memberships/${prospectorId}/scopes`, {
          ...input,
          teamId: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
    const denied = await call('POST', `/memberships/${prospectorId}/scopes`, input);
    expect(denied.statusCode, denied.body).toBe(201);
    expect(denied.json()).toMatchObject({ effect: 'deny', scopeType: 'team', resourceId: teamId });
    expect((await call('POST', `/memberships/${prospectorId}/scopes`, input)).statusCode).toBe(409);
    expect(
      (await call('GET', `/campaigns/${campaignId}`, undefined, prospectorId)).statusCode,
    ).toBe(403);
    expect((await call('GET', '/notifications', undefined, prospectorId)).statusCode).toBe(403);
    expect((await call('GET', '/me', undefined, prospectorId)).statusCode).toBe(200);
    const rules = (await call('GET', `/memberships/${prospectorId}/scopes`)).json();
    const rule = rules.find((r: { id: string }) => r.id === denied.json().id);
    const removed = await call(
      'DELETE',
      `/membership-scopes/${rule.id}`,
      undefined,
      adminId,
      randomUUID(),
      { 'if-match': rule.etag },
    );
    expect(removed.statusCode, removed.body).toBe(204);
    expect((await call('GET', '/notifications', undefined, prospectorId)).statusCode).toBe(200);
    const history = (await call('GET', `/memberships/${prospectorId}/access-history`)).json().items;
    expect(history.some((r: { action: string }) => r.action === 'membership.deny_removed')).toBe(
      true,
    );
  });
  it('enforces tenant, organization and campaign deny scopes and stale versions', async () => {
    for (const rule of [
      { scopeType: 'tenant' },
      { scopeType: 'organization', organizationId: orgId },
      { scopeType: 'campaign', campaignId },
    ]) {
      const added = await call('POST', `/memberships/${prospectorId}/scopes`, {
        ...rule,
        effect: 'deny',
        reason: 'Temporary restriction',
      });
      expect(added.statusCode, added.body).toBe(201);
      expect(
        (await call('GET', `/campaigns/${campaignId}`, undefined, prospectorId)).statusCode,
      ).toBe(403);
      const path = `/membership-scopes/${added.json().id}`;
      expect(
        (await call('DELETE', path, undefined, adminId, randomUUID(), { 'if-match': '"stale"' }))
          .statusCode,
      ).toBe(412);
      expect(
        (
          await call('DELETE', path, undefined, adminId, randomUUID(), {
            'if-match': String(added.headers.etag),
          })
        ).statusCode,
      ).toBe(204);
    }
    const added = await call('POST', `/memberships/${prospectorId}/scopes`, {
      scopeType: 'organization',
      organizationId: otherOrgId,
      effect: 'deny',
      reason: 'Other organization denied',
    });
    expect(added.statusCode).toBe(201);
    // A bounded resource disconnected from the denied organization remains readable.
    expect((await call('GET', `/teams/${teamId}`, undefined, prospectorId)).statusCode).toBe(200);
    expect((await call('DELETE', `/membership-scopes/${added.json().id}`)).statusCode).toBe(204);
  });
  it('stores tenant OIDC configuration with encrypted and redacted client secrets', async () => {
    const before = await call('GET', '/settings/security');
    expect(before.statusCode).toBe(200);
    expect(before.json().sso).toMatchObject({ mode: 'disabled', loginAvailable: false });
    const sso = {
      provider: 'oidc',
      mode: 'configured',
      issuer: 'https://identity.example.test/tenant',
      clientId: 'trackroster',
      clientSecret: 'local-oidc-test-client-secret',
      allowedDomains: ['Example.Test'],
    };
    const response = await call('PATCH', '/settings/security', { sso }, adminId, randomUUID(), {
      'if-match': String(before.headers.etag),
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().sso).toMatchObject({
      mode: 'configured',
      clientSecretConfigured: true,
      allowedDomains: ['example.test'],
      loginAvailable: false,
    });
    expect(response.body).not.toContain(sso.clientSecret);
    const stored = await db.execute(
      sql`SELECT sso FROM tenant_security_policies WHERE tenant_id=${tenantId}`,
    );
    expect(JSON.stringify(stored.rows)).not.toContain(sso.clientSecret);
    expect(
      (stored.rows[0]!.sso as { encryptedClientSecret: string }).encryptedClientSecret,
    ).toMatch(/^v1\./);
    const audits = await db.select().from(auditEvents).where(eq(auditEvents.tenantId, tenantId));
    expect(JSON.stringify(audits)).not.toContain(sso.clientSecret);
    expect(JSON.stringify(audits)).not.toContain('encryptedClientSecret');
    expect((await call('GET', '/settings/security', undefined, prospectorId)).statusCode).toBe(403);
    expect(
      (
        await call('PATCH', '/settings/security', { sso }, adminId, randomUUID(), {
          'if-match': String(before.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    expect(
      (
        await call('PATCH', '/settings/security', {
          sso: { ...sso, issuer: 'http://identity.example.test' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call('PATCH', '/settings/security', {
          sso: { ...sso, issuer: 'https://identity.example.test?secret=value' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await call('PATCH', '/settings/security', { sso: { ...sso, mode: 'enabled' } })).statusCode,
    ).toBe(400);
    const fresh = await call('GET', '/settings/security');
    expect(fresh.json().sso.clientSecretConfigured).toBe(true);
    const { clientSecret: ignored, ...withoutSecret } = sso;
    void ignored;
    const disabled = await call(
      'PATCH',
      '/settings/security',
      { sso: { ...withoutSecret, mode: 'disabled' } },
      adminId,
      randomUUID(),
      { 'if-match': String(fresh.headers.etag) },
    );
    expect(disabled.statusCode, disabled.body).toBe(200);
    expect(disabled.json().sso).toMatchObject({ mode: 'disabled', clientSecretConfigured: true });
    const cleared = await call('PATCH', '/settings/security', { sso: null });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().sso.clientSecretConfigured).toBe(false);
  });
  it('replaces a membership role explicitly and rejects replay after its authority is removed', async () => {
    expect(
      (
        await call('PUT', '/roles/manager/permissions', {
          permissions: [
            'assignments.manage',
            'collisions.override',
            'exports.create',
            'teams.manage',
          ],
        })
      ).statusCode,
    ).toBe(200);
    const changed = await call('PATCH', `/memberships/${managerId}`, {
      role: 'auditor',
      reason: 'Moved to audit responsibilities',
    });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().scopes).toHaveLength(1);
    expect(changed.json().scopes[0].role).toBe('auditor');
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaignId}/prospects/${prospects[2]}/assignment`,
          { teamId },
          managerId,
          replayKey,
        )
      ).statusCode,
    ).toBe(403);
  });

  it('does not permit either administration API to bypass invitation acceptance', async () => {
    const email = `pending-${randomUUID()}@example.test`;
    const invited = await call('POST', '/memberships', { email, role: 'auditor' });
    expect(invited.statusCode).toBe(201);
    const id = invited.json().membershipId as string;
    const [identity] = await db.select().from(identities).where(eq(identities.email, email));
    ids.push(identity!.id);
    expect((await call('PATCH', `/users/${id}/status`, { status: 'active' })).statusCode).toBe(409);
    expect(
      (
        await call('PATCH', `/memberships/${id}`, {
          status: 'active',
          reason: 'Attempt to bypass invitation',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call('PATCH', `/memberships/${id}`, {
          status: 'departed',
          reason: 'Invitation canceled',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('POST', `/memberships/${id}/reactivate`, {
          reason: 'Attempt to reactivate canceled invitation',
        })
      ).statusCode,
    ).toBe(409);
  });

  it('serializes last-administrator removal even across concurrent status requests', async () => {
    const auth = {
      tenantId,
      userId: adminId,
      membershipId: adminId,
      identityId: adminId,
      sessionId: randomUUID(),
      tokenId: randomUUID(),
    } satisfies AuthenticatedPrincipal;
    const service = app.get(MembershipService);
    const results = await Promise.allSettled([
      service.update(auth, adminId, { status: 'suspended', reason: 'Admin transition' }),
      service.update(auth, secondAdminId, { status: 'suspended', reason: 'Admin transition' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
