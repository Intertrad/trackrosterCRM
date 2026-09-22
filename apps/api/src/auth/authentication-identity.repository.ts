import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { identities, type Identity } from '../database/schema/identities.js';
import { tenantMemberships } from '../database/schema/tenant-memberships.js';
import { tenants } from '../database/schema/tenants.js';
import { users } from '../database/schema/users.js';
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
    return executor
      .select({
        identityId: tenantMemberships.identityId,
        membershipId: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        tenantName: tenants.name,
        displayName: tenantMemberships.displayName,
        legacyUserId: users.id,
      })
      .from(tenantMemberships)
      .innerJoin(
        identities,
        and(eq(identities.id, tenantMemberships.identityId), eq(identities.status, 'active')),
      )
      .innerJoin(
        tenants,
        and(eq(tenants.id, tenantMemberships.tenantId), eq(tenants.status, 'active')),
      )
      .leftJoin(
        users,
        and(
          eq(users.id, tenantMemberships.id),
          eq(users.tenantId, tenantMemberships.tenantId),
          eq(users.email, identities.email),
          eq(users.passwordHash, identities.passwordHash),
          eq(users.status, 'active'),
        ),
      )
      .where(
        and(eq(tenantMemberships.identityId, identityId), eq(tenantMemberships.status, 'active')),
      )
      .orderBy(asc(tenants.name), asc(tenantMemberships.id));
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
