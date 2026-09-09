import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  prospectActivities,
  type ProspectActivity,
  type ProspectActivityType,
} from '../database/schema/prospect-activities.js';
import { campaigns } from '../database/schema/campaigns.js';
import type {
  ProspectTimelineRepositoryOptions,
  ProspectTimelineRepositoryPage,
} from './prospect-timeline.types.js';

export interface CreateProspectActivityInput {
  tenantId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  userId: string;

  reservationId: string;

  type: ProspectActivityType;
}

export type ProspectActivityCollisionCandidate = ProspectActivity & {
  organizationId: string;
};

@Injectable()
export class ProspectActivityRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(
    input: CreateProspectActivityInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<ProspectActivity> {
    const [activity] = await executor
      .insert(prospectActivities)
      .values({
        tenantId: input.tenantId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        establishmentId: input.establishmentId,

        assignmentId: input.assignmentId,

        userId: input.userId,

        reservationId: input.reservationId,

        type: input.type,
      })
      .returning();

    if (!activity) {
      throw new Error('Failed to create prospect activity');
    }

    return activity;
  }

  async findLatestByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<ProspectActivity | null> {
    const [activity] = await this.database
      .select()
      .from(prospectActivities)
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.establishmentId, establishmentId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),

        desc(prospectActivities.id),
      )
      .limit(1);

    return activity ?? null;
  }

  /*
   * Used by TR-017 collision evaluation.
   *
   * Every activity candidate includes the
   * organization that owns its campaign so
   * coordination policy can be evaluated.
   */
  async findCandidatesByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<ProspectActivityCollisionCandidate[]> {
    return this.database
      .select({
        id: prospectActivities.id,

        tenantId: prospectActivities.tenantId,

        campaignId: prospectActivities.campaignId,

        campaignProspectId: prospectActivities.campaignProspectId,

        establishmentId: prospectActivities.establishmentId,

        assignmentId: prospectActivities.assignmentId,

        userId: prospectActivities.userId,

        reservationId: prospectActivities.reservationId,

        type: prospectActivities.type,

        occurredAt: prospectActivities.occurredAt,

        createdAt: prospectActivities.createdAt,

        organizationId: campaigns.organizationId,
      })
      .from(prospectActivities)
      .innerJoin(
        campaigns,
        and(
          eq(prospectActivities.tenantId, campaigns.tenantId),

          eq(prospectActivities.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.establishmentId, establishmentId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),

        desc(prospectActivities.id),
      );
  }

  /*
   * Existing non-paginated history query.
   *
   * Keep it temporarily because another service
   * or test may still depend on it.
   *
   * TR-018 timeline reads should use
   * findTimelineByCampaignProspect().
   */
  async findByCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<ProspectActivity[]> {
    return this.database
      .select()
      .from(prospectActivities)
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          eq(prospectActivities.campaignId, campaignId),

          eq(prospectActivities.campaignProspectId, campaignProspectId),
        ),
      )
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),

        desc(prospectActivities.id),
      );
  }

  /*
   * TR-018 immutable timeline query.
   *
   * Ordering is deterministic:
   *
   * occurredAt DESC
   * createdAt  DESC
   * id         DESC
   *
   * The third key matters when two immutable
   * events happen to share identical timestamps.
   */
  async findTimelineByCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    options: ProspectTimelineRepositoryOptions,
  ): Promise<ProspectTimelineRepositoryPage> {
    const { limit, cursor = null } = options;

    const baseCondition = and(
      eq(prospectActivities.tenantId, tenantId),

      eq(prospectActivities.campaignId, campaignId),

      eq(prospectActivities.campaignProspectId, campaignProspectId),
    );

    const cursorCondition = cursor
      ? or(
          lt(prospectActivities.occurredAt, cursor.occurredAt),

          and(
            eq(prospectActivities.occurredAt, cursor.occurredAt),

            lt(prospectActivities.createdAt, cursor.createdAt),
          ),

          and(
            eq(prospectActivities.occurredAt, cursor.occurredAt),

            eq(prospectActivities.createdAt, cursor.createdAt),

            lt(prospectActivities.id, cursor.id),
          ),
        )
      : undefined;

    const rows = await this.database
      .select()
      .from(prospectActivities)
      .where(cursorCondition ? and(baseCondition, cursorCondition) : baseCondition)
      .orderBy(
        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),

        desc(prospectActivities.id),
      )
      /*
       * Fetch one extra row so we know whether
       * another page exists.
       */
      .limit(limit + 1);

    const hasNextPage = rows.length > limit;

    const items = hasNextPage ? rows.slice(0, limit) : rows;

    const lastItem = items.at(-1);

    return {
      items,

      nextCursor:
        hasNextPage && lastItem
          ? {
              occurredAt: lastItem.occurredAt,

              createdAt: lastItem.createdAt,

              id: lastItem.id,
            }
          : null,
    };
  }
}
