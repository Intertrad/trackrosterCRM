import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { AuthSession, authSessions, NewAuthSession } from '../database/schema/auth-sessions.js';
import { identities } from '../database/schema/identities.js';
import { tenantMemberships } from '../database/schema/tenant-memberships.js';
import { tenants } from '../database/schema/tenants.js';
import { tenantSecurityPolicies } from '../database/schema/security-policies.js';
import { auditEvents } from '../database/schema/audit-events.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { withTenantContext } from '../database/tenant-context.js';

export interface AuthenticationSessionPrincipal {
  sessionId: string;

  identityId: string;

  membershipId: string;

  tenantId: string;
}

@Injectable()
export class AuthSessionRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewAuthSession, executor?: DatabaseExecutor): Promise<AuthSession> {
    if (!executor)
      return this.database.transaction((transaction) => this.create(input, transaction));
    const [session] = await executor.insert(authSessions).values(input).returning();

    if (!session) {
      throw new Error('Failed to create authentication session');
    }

    await executor.insert(auditEvents).values({
      tenantId: session.tenantId,
      actorType: 'user',
      actorUserId: session.membershipId,
      action: 'session.created',
      resourceType: 'auth_session',
      resourceId: session.id,
      metadata: { identityId: session.identityId },
    });
    return session;
  }

  async findActiveById(
    input: AuthenticationSessionPrincipal,
    executor?: DatabaseExecutor,
  ): Promise<AuthSession | null> {
    /*
     * Session validation happens before the request has a tenant context:
     * AuthGuard runs ahead of TenantTransactionInterceptor, which is what
     * establishes it. Under the non-privileged runtime role that leaves
     * `auth_sessions` invisible and every authenticated request answering
     * 401 with a perfectly valid token.
     *
     * The tenant here comes from an access token whose signature has already
     * been verified, so it is as trustworthy as the session it is about to
     * look up. Scoping the read to it is both what RLS needs and what the
     * query already filtered on.
     */
    if (!executor) {
      return withTenantContext(this.database, input.tenantId, (tx) =>
        this.findActiveById(input, tx),
      );
    }

    const [row] = await executor
      .select({
        session: authSessions,
      })
      .from(authSessions)
      .innerJoin(
        identities,
        and(eq(identities.id, authSessions.identityId), eq(identities.status, 'active')),
      )
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.tenantId, authSessions.tenantId),
          eq(tenantMemberships.id, authSessions.membershipId),
          eq(tenantMemberships.identityId, authSessions.identityId),
          eq(tenantMemberships.status, 'active'),
        ),
      )
      .innerJoin(tenants, and(eq(tenants.id, authSessions.tenantId), eq(tenants.status, 'active')))
      .leftJoin(tenantSecurityPolicies, eq(tenantSecurityPolicies.tenantId, authSessions.tenantId))
      .where(
        and(
          sql`(NOT coalesce(${tenantSecurityPolicies.requireMfa}, false) OR ${identities.mfaEnrolledAt} IS NOT NULL)`,
          sql`${authSessions.createdAt} + coalesce(${tenantSecurityPolicies.sessionMaxHours}, 168) * interval '1 hour' > clock_timestamp()`,
          eq(authSessions.id, input.sessionId),
          eq(authSessions.identityId, input.identityId),
          eq(authSessions.membershipId, input.membershipId),
          eq(authSessions.tenantId, input.tenantId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, sql`CURRENT_TIMESTAMP`),
          gt(authSessions.absoluteExpiresAt, sql`CURRENT_TIMESTAMP`),
        ),
      )
      .limit(1);

    return row?.session ?? null;
  }

  async switchWorkspace<T>(
    principal: AuthenticationSessionPrincipal,
    createSession: (executor: DatabaseExecutor) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) => {
      // Follow the same identity -> session lock order as credential/MFA changes.
      // Otherwise a switch could create a session while an identity-triggered
      // revocation waits on the source session using an older statement snapshot.
      await transaction
        .select({ id: identities.id })
        .from(identities)
        .where(eq(identities.id, principal.identityId))
        .for('share');
      // Serialize switches and revocations of the source session.
      await transaction
        .select({ id: authSessions.id })
        .from(authSessions)
        .where(
          and(
            eq(authSessions.id, principal.sessionId),
            eq(authSessions.identityId, principal.identityId),
            eq(authSessions.membershipId, principal.membershipId),
            eq(authSessions.tenantId, principal.tenantId),
          ),
        )
        .for('update');
      if (!(await this.findActiveById(principal, transaction))) {
        throw new UnauthorizedException('Session is no longer active');
      }
      const result = await createSession(transaction);
      await transaction
        .update(authSessions)
        .set({
          revokedAt: sql`CURRENT_TIMESTAMP`,
          revokedReason: 'workspace_switch',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(authSessions.id, principal.sessionId));
      await transaction.insert(auditEvents).values({
        tenantId: principal.tenantId,
        actorType: 'user',
        actorUserId: principal.membershipId,
        action: 'session.workspace_switched',
        resourceType: 'auth_session',
        resourceId: principal.sessionId,
        metadata: { identityId: principal.identityId },
      });
      return result;
    });
  }

  async rotate(
    principal: AuthenticationSessionPrincipal,
    currentRefreshTokenHash: string,
    newRefreshTokenHash: string,
    expiresAt: Date,
  ): Promise<AuthSession | null> {
    const [session] = await this.database
      .update(authSessions)
      .set({
        refreshTokenHash: newRefreshTokenHash,
        expiresAt,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(authSessions.id, principal.sessionId),
          eq(authSessions.identityId, principal.identityId),
          eq(authSessions.membershipId, principal.membershipId),
          eq(authSessions.tenantId, principal.tenantId),
          eq(authSessions.refreshTokenHash, currentRefreshTokenHash),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, sql`CURRENT_TIMESTAMP`),
          gt(authSessions.absoluteExpiresAt, sql`CURRENT_TIMESTAMP`),
        ),
      )
      .returning();

    return session ?? null;
  }

  async revoke(
    principal: AuthenticationSessionPrincipal,
    reason: 'logout' | 'refresh_reuse',
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const [session] = await transaction
        .update(authSessions)
        .set({
          revokedAt: sql`CURRENT_TIMESTAMP`,
          revokedReason: reason,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(authSessions.id, principal.sessionId),
            eq(authSessions.identityId, principal.identityId),
            eq(authSessions.membershipId, principal.membershipId),
            eq(authSessions.tenantId, principal.tenantId),
            isNull(authSessions.revokedAt),
          ),
        )
        .returning({
          id: authSessions.id,
        });

      if (session)
        await transaction.insert(auditEvents).values({
          tenantId: principal.tenantId,
          actorType: 'user',
          actorUserId: principal.membershipId,
          action: 'session.revoked',
          resourceType: 'auth_session',
          resourceId: session.id,
          metadata: { reason, identityId: principal.identityId },
        });
      return Boolean(session);
    });
  }
}
