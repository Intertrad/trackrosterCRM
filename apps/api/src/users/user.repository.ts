import { auditEvents } from '../database/schema/audit-events.js';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewUser, User, users } from '../database/schema/users.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';
import { identities } from '../database/schema/identities.js';
import { tenantMemberships } from '../database/schema/tenant-memberships.js';
import { assertAdministratorRemains } from '../authorization/administrator-continuity.js';

// Existing business services use userId to mean the tenant actor. During the
// compatibility period that field now projects the membership, never identity ID.
const membershipUserColumns = {
  id: tenantMemberships.id,
  tenantId: tenantMemberships.tenantId,
  email: identities.email,
  displayName: tenantMemberships.displayName,
  passwordHash: sql<string>`coalesce(${identities.passwordHash}, '')`,
  status: sql<User['status']>`case
    when ${identities.status} = 'disabled' or ${tenantMemberships.status} = 'departed' then 'disabled'
    when ${identities.status} = 'suspended' or ${tenantMemberships.status} <> 'active' then 'suspended'
    else 'active' end`,
  createdAt: tenantMemberships.createdAt,
  updatedAt: tenantMemberships.updatedAt,
};

@Injectable()
export class UserRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewUser): Promise<User> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, input.tenantId, (tx) =>
        this.createWithExecutor(input, tx),
      );
    return this.createWithExecutor(input, this.database);
  }

  private async createWithExecutor(input: NewUser, executor: DatabaseExecutor): Promise<User> {
    const [user] = await executor.insert(users).values(input).returning();

    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.database
      .select(membershipUserColumns)
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(eq(identities.email, email))
      .orderBy(asc(tenantMemberships.createdAt), asc(tenantMemberships.id))
      .limit(1);

    return user ?? null;
  }

  async findById(tenantId: string, userId: string): Promise<User | null> {
    const [user] = await this.database
      .select(membershipUserColumns)
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.id, userId)))
      .limit(1);

    return user ?? null;
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.database
      .select(membershipUserColumns)
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(eq(tenantMemberships.tenantId, tenantId))
      .orderBy(asc(tenantMemberships.createdAt), asc(tenantMemberships.id));
  }

  async updatePasswordHash(
    tenantId: string,
    userId: string,
    passwordHash: string,
  ): Promise<User | null> {
    await this.database
      .update(identities)
      .set({
        passwordHash,
        credentialsUpdatedAt: sql`greatest(clock_timestamp(), ${identities.credentialsUpdatedAt} + interval '1 microsecond')`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(
        eq(
          identities.id,
          sql`(select identity_id from tenant_memberships where tenant_id = ${tenantId} and id = ${userId})`,
        ),
      );
    return this.findById(tenantId, userId);
  }

  async updateDisplayName(
    tenantId: string,
    userId: string,
    displayName: string | null,
  ): Promise<User | null> {
    await this.database
      .update(tenantMemberships)
      .set({ displayName, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.id, userId)));
    return this.findById(tenantId, userId);
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    status: User['status'],
    actorUserId?: string,
  ): Promise<User | null> {
    // Membership suspension must not disable the person's other workspaces.
    const membership = await this.database.transaction(async (transaction) => {
      if (status !== 'active') await assertAdministratorRemains(transaction, tenantId, userId);
      const [before] = await transaction
        .select()
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.id, userId)))
        .for('update');
      if (!before) return undefined;
      if (actorUserId && before.status === 'invited' && status !== 'disabled')
        throw new ConflictException('Pending invitations must be accepted by the invitee');
      if (actorUserId && before.status === 'departed' && status !== 'disabled')
        throw new ConflictException('Departed memberships cannot be reactivated');
      if (actorUserId && status === 'disabled') {
        const work = await transaction.execute(
          sql`SELECT 1 FROM campaign_prospect_assignments WHERE tenant_id = ${tenantId} AND assigned_user_id = ${userId} AND ended_at IS NULL LIMIT 1`,
        );
        if (work.rows.length)
          throw new ConflictException('Reassign active work before ending membership');
      }
      const [updated] = await transaction
        .update(tenantMemberships)
        .set({
          status: status === 'disabled' ? 'departed' : status,
          activatedAt: sql`coalesce(${tenantMemberships.activatedAt}, CURRENT_TIMESTAMP)`,
          suspendedAt: status === 'suspended' ? sql`CURRENT_TIMESTAMP` : null,
          departedAt: status === 'disabled' ? sql`CURRENT_TIMESTAMP` : null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.id, userId)))
        .returning();
      if (actorUserId && updated)
        await transaction.insert(auditEvents).values({
          tenantId,
          actorType: 'user',
          actorUserId,
          action: 'membership.status_updated',
          resourceType: 'tenant_membership',
          resourceId: userId,
          metadata: {
            before: before.status,
            after: updated.status,
            source: 'legacy_user_administration',
          },
        });
      return updated;
    });

    return membership ? this.findById(tenantId, userId) : null;
  }
}
