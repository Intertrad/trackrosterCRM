import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuthSessionRepository } from '../src/auth/auth-session.repository.js';
import type { Database } from '../src/database/database.types.js';
import { authSessions } from '../src/database/schema/auth-sessions.js';
import { identities } from '../src/database/schema/identities.js';
import { tenantMemberships } from '../src/database/schema/tenant-memberships.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('Authentication session schema integration', () => {
  let app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;
  let database: Database | undefined;
  let authSessionRepository: AuthSessionRepository;

  let tenantId = '';
  const userIds: string[] = [];

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Integration database has not been initialized');
    }

    return database;
  }

  function postgresConstraint(code: string, constraint: string): object {
    return {
      cause: {
        code,
        constraint,
      },
    };
  }

  function uniqueRefreshTokenHash(): string {
    return `${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
  }

  async function createActiveSession(userId: string): Promise<{
    id: string;
    refreshTokenHash: string;
  }> {
    const id = randomUUID();
    const refreshTokenHash = uniqueRefreshTokenHash();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const absoluteExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1_000);

    await authSessionRepository.create({
      id,
      userId,
      identityId: userId,
      membershipId: userId,
      tenantId,
      refreshTokenHash,
      expiresAt,
      absoluteExpiresAt,
    });

    return {
      id,
      refreshTokenHash,
    };
  }

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });

    database = getSeedDatabase();
    /*
     * Built on the seed (owner) connection rather than resolved from the
     * container: these cases drive the repository directly, with no request
     * and so no tenant scope, which RLS refuses once the application connects
     * as `trackroster_app`. The SQL under test is unchanged.
     */
    authSessionRepository = new AuthSessionRepository(getSeedDatabase());

    const tenantService = app.get(TenantService);
    const userRepository = app.get(UserRepository);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);

    const tenant = await tenantService.create({
      name: `Auth Session Schema ${suffix}`,
      slug: `auth-session-schema-${suffix}`,
    });

    tenantId = tenant.id;

    for (const label of ['first', 'second']) {
      const user = await userRepository.create({
        tenantId,
        email: `auth-session-${label}-${suffix}@trackroster.test`,
        passwordHash: `auth-session-${label}-password-hash`,
        status: 'active',
      });

      userIds.push(user.id);
    }
  });

  afterAll(async () => {
    try {
      if (database && userIds.length > 0) {
        await clearSessionEvidenceForUsers(database, inArray(users.id, userIds));
        await database.delete(users).where(inArray(users.id, userIds));
      }

      if (database && tenantId) {
        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('fills exact identity, membership, tenant, and absolute lifetime for a legacy insert', async () => {
    const sessionId = randomUUID();
    const userId = userIds[0];
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const refreshTokenHash = uniqueRefreshTokenHash();

    if (!userId) {
      throw new Error('Legacy session user fixture is missing');
    }

    await getDatabase().execute(sql`
      INSERT INTO auth_sessions (
        id,
        user_id,
        refresh_token_hash,
        expires_at
      )
      VALUES (
        ${sessionId}::uuid,
        ${userId}::uuid,
        ${refreshTokenHash},
        ${expiresAt}
      )
    `);

    const [session] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .limit(1);

    expect(session).toMatchObject({
      id: sessionId,
      userId,
      identityId: userId,
      membershipId: userId,
      tenantId,
      revokedAt: null,
      revokedReason: null,
    });
    expect(session?.absoluteExpiresAt).toEqual(expiresAt);
  });

  it('rejects a session that mixes one identity with another membership', async () => {
    const identityId = userIds[0];
    const membershipId = userIds[1];
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);

    if (!identityId || !membershipId) {
      throw new Error('Composite session fixtures are missing');
    }

    await expect(
      getDatabase().insert(authSessions).values({
        identityId,
        membershipId,
        tenantId,
        userId: null,
        refreshTokenHash: uniqueRefreshTokenHash(),
        expiresAt,
        absoluteExpiresAt: expiresAt,
      }),
    ).rejects.toMatchObject(
      postgresConstraint('23503', 'auth_sessions_tenant_membership_identity_fk'),
    );
  });

  it('scopes active lookup and refresh rotation to the exact session principal', async () => {
    const sessionId = randomUUID();
    const userId = userIds[0];
    const expiresAt = new Date(Date.now() + 60 * 60 * 1_000);
    const absoluteExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1_000);
    const currentRefreshTokenHash = uniqueRefreshTokenHash();
    const rotatedRefreshTokenHash = uniqueRefreshTokenHash();
    const staleRefreshTokenHash = uniqueRefreshTokenHash();

    if (!userId) {
      throw new Error('Exact session fixture is missing');
    }

    await authSessionRepository.create({
      id: sessionId,
      userId,
      identityId: userId,
      membershipId: userId,
      tenantId,
      refreshTokenHash: currentRefreshTokenHash,
      expiresAt,
      absoluteExpiresAt,
    });

    const principal = {
      sessionId,
      identityId: userId,
      membershipId: userId,
      tenantId,
    };

    await expect(authSessionRepository.findActiveById(principal)).resolves.toMatchObject({
      id: sessionId,
      identityId: userId,
      membershipId: userId,
      tenantId,
    });

    await expect(
      authSessionRepository.findActiveById({
        ...principal,
        membershipId: userIds[1] ?? randomUUID(),
      }),
    ).resolves.toBeNull();

    const rotated = await authSessionRepository.rotate(
      principal,
      currentRefreshTokenHash,
      rotatedRefreshTokenHash,
      new Date(absoluteExpiresAt.getTime() + 60 * 60 * 1_000),
    );

    expect(rotated?.refreshTokenHash).toBe(rotatedRefreshTokenHash);
    expect(rotated?.expiresAt).toEqual(absoluteExpiresAt);
    expect(rotated?.absoluteExpiresAt).toEqual(absoluteExpiresAt);

    await expect(
      authSessionRepository.rotate(
        principal,
        currentRefreshTokenHash,
        staleRefreshTokenHash,
        absoluteExpiresAt,
      ),
    ).resolves.toBeNull();
  });

  it('prevents an authentication session principal from being reparented', async () => {
    const userId = userIds[0];
    const otherUserId = userIds[1];

    if (!userId || !otherUserId) {
      throw new Error('Immutable principal fixtures are missing');
    }

    const [session] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.identityId, userId))
      .limit(1);

    if (!session) {
      throw new Error('Authentication session fixture is missing');
    }

    await expect(
      getDatabase()
        .update(authSessions)
        .set({
          identityId: otherUserId,
          membershipId: otherUserId,
        })
        .where(eq(authSessions.id, session.id)),
    ).rejects.toMatchObject({
      cause: {
        code: '23000',
      },
    });
  });

  it('makes revoked session state, token hash, and expiry immutable', async () => {
    const userId = userIds[0];

    if (!userId) {
      throw new Error('Revoked session fixture user is missing');
    }

    const fixture = await createActiveSession(userId);
    const principal = {
      sessionId: fixture.id,
      identityId: userId,
      membershipId: userId,
      tenantId,
    };

    await expect(authSessionRepository.revoke(principal, 'logout')).resolves.toBe(true);

    const [revoked] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, fixture.id))
      .limit(1);

    expect(revoked?.revokedAt).toBeInstanceOf(Date);
    expect(revoked?.revokedReason).toBe('logout');

    await expect(
      getDatabase()
        .update(authSessions)
        .set({
          revokedAt: null,
          revokedReason: null,
        })
        .where(eq(authSessions.id, fixture.id)),
    ).rejects.toMatchObject({ cause: { code: '23000' } });

    await expect(
      getDatabase()
        .update(authSessions)
        .set({
          refreshTokenHash: uniqueRefreshTokenHash(),
        })
        .where(eq(authSessions.id, fixture.id)),
    ).rejects.toMatchObject({ cause: { code: '23000' } });

    await expect(
      getDatabase()
        .update(authSessions)
        .set({
          expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1_000),
        })
        .where(eq(authSessions.id, fixture.id)),
    ).rejects.toMatchObject({ cause: { code: '23000' } });

    const [unchanged] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, fixture.id))
      .limit(1);

    expect(unchanged).toMatchObject({
      refreshTokenHash: fixture.refreshTokenHash,
      revokedReason: 'logout',
    });
    expect(unchanged?.revokedAt).toEqual(revoked?.revokedAt);
    expect(unchanged?.expiresAt).toEqual(revoked?.expiresAt);
  });

  it('revokes an active session on identity suspension and never revives it on reactivation', async () => {
    const userId = userIds[0];

    if (!userId) {
      throw new Error('Identity suspension fixture user is missing');
    }

    const [originalIdentity] = await getDatabase()
      .select()
      .from(identities)
      .where(eq(identities.id, userId))
      .limit(1);

    if (!originalIdentity) {
      throw new Error('Identity suspension fixture is missing');
    }

    const fixture = await createActiveSession(userId);
    const suspendedAt = new Date(
      Math.max(Date.now(), originalIdentity.securityStateUpdatedAt.getTime()) + 1_000,
    );

    try {
      await getDatabase()
        .update(identities)
        .set({
          status: 'suspended',
          suspendedAt,
          securityStateUpdatedAt: suspendedAt,
          updatedAt: suspendedAt,
        })
        .where(eq(identities.id, userId));

      const [suspendedSession] = await getDatabase()
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, fixture.id))
        .limit(1);

      expect(suspendedSession?.revokedAt).toBeInstanceOf(Date);
      expect(suspendedSession?.revokedReason).toBe('identity_security_change');
    } finally {
      const reactivatedAt = new Date(suspendedAt.getTime() + 1_000);

      await getDatabase()
        .update(identities)
        .set({
          status: 'active',
          suspendedAt: null,
          disabledAt: null,
          securityStateUpdatedAt: reactivatedAt,
          updatedAt: reactivatedAt,
        })
        .where(eq(identities.id, userId));
    }

    const [reactivatedSession] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, fixture.id))
      .limit(1);

    expect(reactivatedSession?.revokedAt).toBeInstanceOf(Date);
    expect(reactivatedSession?.revokedReason).toBe('identity_security_change');
  });

  it('revokes sessions for direct identity email and MFA changes with advanced epochs', async () => {
    const userId = userIds[0];

    if (!userId) {
      throw new Error('Identity security fixture user is missing');
    }

    const [originalIdentity] = await getDatabase()
      .select()
      .from(identities)
      .where(eq(identities.id, userId))
      .limit(1);

    if (!originalIdentity) {
      throw new Error('Identity security fixture is missing');
    }

    const emailSession = await createActiveSession(userId);
    const emailChangedAt = new Date(
      Math.max(Date.now(), originalIdentity.credentialsUpdatedAt.getTime()) + 1_000,
    );

    try {
      await getDatabase()
        .update(identities)
        .set({
          email: `security-change-${randomUUID()}@trackroster.test`,
          credentialsUpdatedAt: emailChangedAt,
          updatedAt: emailChangedAt,
        })
        .where(eq(identities.id, userId));

      const [emailRevokedSession] = await getDatabase()
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, emailSession.id))
        .limit(1);

      expect(emailRevokedSession?.revokedReason).toBe('identity_security_change');

      const mfaSession = await createActiveSession(userId);
      const mfaChangedAt = new Date(
        Math.max(emailChangedAt.getTime(), originalIdentity.securityStateUpdatedAt.getTime()) +
          1_000,
      );

      await getDatabase()
        .update(identities)
        .set({
          mfaEnrolledAt: mfaChangedAt,
          securityStateUpdatedAt: mfaChangedAt,
          updatedAt: mfaChangedAt,
        })
        .where(eq(identities.id, userId));

      const [mfaRevokedSession] = await getDatabase()
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, mfaSession.id))
        .limit(1);

      expect(mfaRevokedSession?.revokedReason).toBe('identity_security_change');
    } finally {
      const restoredAt = new Date(emailChangedAt.getTime() + 3_000);

      await getDatabase()
        .update(identities)
        .set({
          email: originalIdentity.email,
          emailVerifiedAt: originalIdentity.emailVerifiedAt,
          mfaEnrolledAt: originalIdentity.mfaEnrolledAt,
          mfaRecoveryCodesRotatedAt: originalIdentity.mfaRecoveryCodesRotatedAt,
          credentialsUpdatedAt: restoredAt,
          securityStateUpdatedAt: restoredAt,
          updatedAt: restoredAt,
        })
        .where(eq(identities.id, userId));
    }
  });

  it('rejects credential or MFA changes that do not advance their security epoch', async () => {
    const userId = userIds[0];

    if (!userId) {
      throw new Error('Identity epoch fixture user is missing');
    }

    await expect(
      getDatabase()
        .update(identities)
        .set({
          email: `missing-credential-epoch-${randomUUID()}@trackroster.test`,
        })
        .where(eq(identities.id, userId)),
    ).rejects.toMatchObject({ cause: { code: '23000' } });

    await expect(
      getDatabase()
        .update(identities)
        .set({
          mfaEnrolledAt: new Date(Date.now() + 1_000),
        })
        .where(eq(identities.id, userId)),
    ).rejects.toMatchObject({ cause: { code: '23000' } });
  });

  it('revokes active sessions when either membership or tenant becomes inactive', async () => {
    const userId = userIds[0];

    if (!userId) {
      throw new Error('Membership and tenant state fixture user is missing');
    }

    const [originalMembership] = await getDatabase()
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.id, userId))
      .limit(1);

    const [originalTenant] = await getDatabase()
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!originalMembership || !originalTenant) {
      throw new Error('Membership or tenant state fixture is missing');
    }

    const membershipSession = await createActiveSession(userId);
    const membershipSuspendedAt = new Date(
      Math.max(Date.now(), originalMembership.updatedAt.getTime()) + 1_000,
    );

    try {
      await getDatabase()
        .update(tenantMemberships)
        .set({
          status: 'suspended',
          suspendedAt: membershipSuspendedAt,
          updatedAt: membershipSuspendedAt,
        })
        .where(eq(tenantMemberships.id, userId));

      const [membershipRevokedSession] = await getDatabase()
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, membershipSession.id))
        .limit(1);

      expect(membershipRevokedSession?.revokedReason).toBe('membership_inactive');
    } finally {
      await getDatabase()
        .update(tenantMemberships)
        .set({
          status: originalMembership.status,
          suspendedAt: originalMembership.suspendedAt,
          updatedAt: new Date(membershipSuspendedAt.getTime() + 1_000),
        })
        .where(eq(tenantMemberships.id, userId));
    }

    const tenantSession = await createActiveSession(userId);
    const tenantSuspendedAt = new Date(
      Math.max(Date.now(), originalTenant.updatedAt.getTime()) + 3_000,
    );

    try {
      await getDatabase()
        .update(tenants)
        .set({
          status: 'suspended',
          updatedAt: tenantSuspendedAt,
        })
        .where(eq(tenants.id, tenantId));

      const [tenantRevokedSession] = await getDatabase()
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, tenantSession.id))
        .limit(1);

      expect(tenantRevokedSession?.revokedReason).toBe('tenant_inactive');
    } finally {
      await getDatabase()
        .update(tenants)
        .set({
          status: originalTenant.status,
          updatedAt: new Date(tenantSuspendedAt.getTime() + 1_000),
        })
        .where(eq(tenants.id, tenantId));
    }
  });
});
