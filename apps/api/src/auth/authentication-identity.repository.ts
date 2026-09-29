import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { identities, type Identity } from '../database/schema/identities.js';
import { authWorkspaceChallenges } from '../database/schema/auth-workspace-challenges.js';

export interface ActiveAuthenticationMembership {
  identityId: string;

  membershipId: string;

  tenantId: string;

  tenantName: string;

  displayName: string | null;

  legacyUserId: string | null;
}

@Injectable()
export class AuthenticationIdentityRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async withVerifiedIdentity<T>(
    identity: Identity,
    callback: (current: Identity, executor: DatabaseExecutor) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(identities)
        .where(
          and(
            eq(identities.id, identity.id),
            eq(identities.status, 'active'),
            eq(identities.passwordHash, identity.passwordHash!),
          ),
        )
        .for('share');
      if (!current) throw new UnauthorizedException('Authentication state changed; sign in again');
      return callback(current, tx);
    });
  }

  async findByEmail(email: string): Promise<Identity | null> {
    const [identity] = await this.database
      .select()
      .from(identities)
      .where(eq(identities.email, email))
      .limit(1);

    return identity ?? null;
  }

  async findActiveMemberships(
    identityId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<ActiveAuthenticationMembership[]> {
    /*
     * Sign-in is the one operation that cannot be tenant-scoped: it is the
     * operation that discovers which tenants apply. `identities` is already
     * outside Row-Level Security for that reason, but the memberships behind
     * it are not — so once the API connects as the non-privileged runtime
     * role, the equivalent Drizzle join returns zero rows to an
     * unauthenticated request and every sign-in fails with 401.
     *
     * The lookup therefore goes through a SECURITY DEFINER function with a
     * pinned search_path, exposing only this projection for an identity the
     * caller has already proven possession of. Widening the membership
     * policy instead would trade the tenant boundary for one lookup.
     */
    const result = await executor.execute<{
      identity_id: string;
      membership_id: string;
      tenant_id: string;
      tenant_name: string;
      display_name: string | null;
      legacy_user_id: string | null;
    }>(sql`SELECT * FROM trackroster_authentication_memberships(${identityId}::uuid)`);

    return result.rows.map((row) => ({
      identityId: row.identity_id,
      membershipId: row.membership_id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      displayName: row.display_name,
      legacyUserId: row.legacy_user_id,
    }));
  }

  async createWorkspaceChallenge(
    identity: Identity,
    tokenHash: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<void> {
    // Copy epochs inside SQL: PostgreSQL timestamps have finer precision than
    // JavaScript Date. Also reject a password changed during verification.
    const result = await executor.execute(sql`
      INSERT INTO auth_workspace_challenges
        (token_hash, identity_id, credentials_updated_at, security_state_updated_at, expires_at)
      SELECT ${tokenHash}, id, credentials_updated_at, security_state_updated_at,
        CURRENT_TIMESTAMP + interval '5 minutes'
      FROM identities WHERE id = ${identity.id} AND status = 'active'
        AND password_hash = ${identity.passwordHash}
      RETURNING token_hash
    `);
    if (result.rowCount !== 1)
      throw new UnauthorizedException('Authentication state changed; sign in again');
  }

  async consumeWorkspaceChallenge<T>(
    tokenHash: string,
    membershipId: string,
    createSession: (
      membership: ActiveAuthenticationMembership,
      executor: DatabaseExecutor,
    ) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) => {
      // Updating with the unused predicate is an atomic one-winner claim. An
      // invalid membership or failed session creation rolls the claim back.
      const [challenge] = await transaction
        .update(authWorkspaceChallenges)
        .set({ consumedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(authWorkspaceChallenges.tokenHash, tokenHash),
            isNull(authWorkspaceChallenges.consumedAt),
            gt(authWorkspaceChallenges.expiresAt, sql`CURRENT_TIMESTAMP`),
          ),
        )
        .returning();
      if (!challenge) throw new UnauthorizedException('Invalid or expired workspace selection');
      const [identity] = await transaction
        .select()
        .from(identities)
        .where(
          and(
            eq(identities.id, challenge.identityId),
            eq(identities.status, 'active'),
            sql`${identities.credentialsUpdatedAt} = (select credentials_updated_at from auth_workspace_challenges where token_hash = ${tokenHash})`,
            sql`${identities.securityStateUpdatedAt} = (select security_state_updated_at from auth_workspace_challenges where token_hash = ${tokenHash})`,
          ),
        )
        .for('share');
      if (!identity) throw new UnauthorizedException('Invalid or expired workspace selection');
      const memberships = await this.findActiveMemberships(identity.id, transaction);
      const membership = memberships.find((candidate) => candidate.membershipId === membershipId);
      if (!membership) throw new UnauthorizedException('Workspace is unavailable');
      return createSession(membership, transaction);
    });
  }
}
