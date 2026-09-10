import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import {
  collisionOverrides,
  type CollisionOverride,
  type NewCollisionOverride,
} from '../database/schema/collision-overrides.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';

export interface FindApplicableCollisionOverrideInput {
  tenantId: string;

  overrideId: string;

  campaignId: string;

  campaignProspectId: string;

  prospectorUserId: string;

  now: Date;
}

@Injectable()
export class CollisionOverrideRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: NewCollisionOverride,
    executor: DatabaseExecutor = this.database,
  ): Promise<CollisionOverride> {
    const [override] = await executor.insert(collisionOverrides).values(input).returning();

    if (!override) {
      throw new Error('Failed to create collision override');
    }

    return override;
  }

  async findById(
    tenantId: string,
    overrideId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<CollisionOverride | null> {
    const [override] = await executor
      .select()
      .from(collisionOverrides)
      .where(
        and(
          eq(collisionOverrides.tenantId, tenantId),

          eq(collisionOverrides.id, overrideId),
        ),
      )
      .limit(1);

    return override ?? null;
  }

  async findApplicableById(
    input: FindApplicableCollisionOverrideInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<CollisionOverride | null> {
    const [override] = await executor
      .select()
      .from(collisionOverrides)
      .where(
        and(
          eq(collisionOverrides.tenantId, input.tenantId),

          eq(collisionOverrides.id, input.overrideId),

          eq(collisionOverrides.campaignId, input.campaignId),

          eq(collisionOverrides.campaignProspectId, input.campaignProspectId),

          eq(collisionOverrides.prospectorUserId, input.prospectorUserId),

          /*
           * An override is usable only while its
           * server-controlled validity window remains
           * active.
           *
           * Matching the collision itself remains a
           * service-layer responsibility.
           */
          gt(collisionOverrides.expiresAt, input.now),
        ),
      )
      .limit(1);

    return override ?? null;
  }
}
