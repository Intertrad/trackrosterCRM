import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  NewUserAccessGrant,
  UserAccessGrant,
  userAccessGrants,
} from '../database/schema/user-access-grants.js';
import { Database } from '../database/database.types.js';

@Injectable()
export class UserAccessGrantRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewUserAccessGrant): Promise<UserAccessGrant> {
    const [grant] = await this.database.insert(userAccessGrants).values(input).returning();

    if (!grant) {
      throw new Error('Failed to create user access grant');
    }

    return grant;
  }

  async findById(tenantId: string, grantId: string): Promise<UserAccessGrant | null> {
    const [grant] = await this.database
      .select()
      .from(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.id, grantId)))
      .limit(1);

    return grant ?? null;
  }

  async findByUser(tenantId: string, userId: string): Promise<UserAccessGrant[]> {
    return this.database
      .select()
      .from(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, userId)));
  }

  async deleteById(tenantId: string, userId: string, grantId: string): Promise<boolean> {
    const [grant] = await this.database
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
  ): Promise<UserAccessGrant | null> {
    const [grant] = await this.database
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
