import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  userAccessGrants,
  type NewUserAccessGrant,
  type UserAccessGrant,
} from '../database/schema/user-access-grants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';

@Injectable()
export class UserAccessGrantRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewUserAccessGrant,
    executor: DatabaseExecutor = this.database,
  ): Promise<UserAccessGrant> {
    if (!currentTenantExecutor() && this.database) {
      return withTenantContext(this.database, input.tenantId, (tx) => this.create(input, tx));
    }
    const [grant] = await executor.insert(userAccessGrants).values(input).returning();

    if (!grant) {
      throw new Error('Failed to create user access grant');
    }

    return grant;
  }

  async findById(
    tenantId: string,
    grantId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<UserAccessGrant | null> {
    if (!currentTenantExecutor() && this.database) {
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findById(tenantId, grantId, tx),
      );
    }
    const [grant] = await executor
      .select()
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, tenantId),

          eq(userAccessGrants.id, grantId),
        ),
      )
      .limit(1);

    return grant ?? null;
  }

  async findByUser(
    tenantId: string,
    userId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<UserAccessGrant[]> {
    if (!currentTenantExecutor() && this.database) {
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByUser(tenantId, userId, tx),
      );
    }
    return executor
      .select()
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, tenantId),

          eq(userAccessGrants.userId, userId),
        ),
      );
  }

  async deleteById(
    tenantId: string,
    userId: string,
    grantId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<boolean> {
    if (!currentTenantExecutor() && this.database) {
      return withTenantContext(this.database, tenantId, (tx) =>
        this.deleteById(tenantId, userId, grantId, tx),
      );
    }
    const [grant] = await executor
      .delete(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, tenantId),

          eq(userAccessGrants.userId, userId),

          eq(userAccessGrants.id, grantId),
        ),
      )
      .returning({
        id: userAccessGrants.id,
      });

    return Boolean(grant);
  }

  async findByIdForUser(
    tenantId: string,
    userId: string,
    grantId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<UserAccessGrant | null> {
    if (!currentTenantExecutor() && this.database) {
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByIdForUser(tenantId, userId, grantId, tx),
      );
    }
    const [grant] = await executor
      .select()
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, tenantId),

          eq(userAccessGrants.userId, userId),

          eq(userAccessGrants.id, grantId),
        ),
      )
      .limit(1);

    return grant ?? null;
  }
}
