import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import {
  campaignProspects,
  type CampaignProspectLifecycleStage,
} from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { establishments } from '../database/schema/establishments.js';
import { prospectActivities } from '../database/schema/prospect-activities.js';
import { prospectFollowUps } from '../database/schema/prospect-follow-ups.js';
import type {
  WorkQueueCampaignOption,
  WorkQueueItem,
  WorkQueueLatestActivity,
  WorkQueueNextFollowUp,
  WorkQueueProspectDetail,
} from './work-queue.types.js';

export interface FindWorkQueueInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId?: string;

  lifecycleStage?: CampaignProspectLifecycleStage;

  search?: string;

  limit: number;

  cursor?: {
    assignedAt: Date;

    assignmentId: string;
  };
}

export interface FindWorkQueueCampaignOptionsInput {
  tenantId: string;

  userId: string;

  teamId: string;
}
export interface FindWorkQueueProspectDetailInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId: string;

  campaignProspectId: string;
}

interface WorkQueueFollowUpTarget {
  campaignId: string;

  campaignProspectId: string;

  assignmentId: string;
}

@Injectable()
export class WorkQueueRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findCampaignOptions(
    input: FindWorkQueueCampaignOptionsInput,
  ): Promise<WorkQueueCampaignOption[]> {
    return this.database
      .selectDistinct({
        id: campaigns.id,

        name: campaigns.name,
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,

        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),

          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),

          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,

        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),

          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, input.tenantId),

          eq(campaignProspectAssignments.assignedUserId, input.userId),

          eq(campaignProspectAssignments.teamId, input.teamId),

          isNull(campaignProspectAssignments.endedAt),

          eq(campaigns.status, 'active'),

          eq(campaignProspects.status, 'active'),
        ),
      )
      .orderBy(asc(campaigns.name), asc(campaigns.id));
  }

  async findAssignedProspects(input: FindWorkQueueInput): Promise<WorkQueueItem[]> {
    const conditions: SQL[] = [
      eq(campaignProspectAssignments.tenantId, input.tenantId),

      eq(campaignProspectAssignments.assignedUserId, input.userId),

      eq(campaignProspectAssignments.teamId, input.teamId),

      isNull(campaignProspectAssignments.endedAt),

      eq(campaigns.status, 'active'),

      eq(campaignProspects.status, 'active'),
    ];

    if (input.campaignId) {
      conditions.push(eq(campaigns.id, input.campaignId));
    }

    if (input.lifecycleStage) {
      conditions.push(eq(campaignProspects.lifecycleStage, input.lifecycleStage));
    }

    const search = input.search?.trim();

    if (search) {
      const pattern = `%${this.escapeLikePattern(search)}%`;

      const searchCondition = or(
        ilike(establishments.name, pattern),

        ilike(establishments.addressLine1, pattern),

        ilike(establishments.city, pattern),

        ilike(establishments.postalCode, pattern),
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (input.cursor) {
      const cursorCondition = or(
        lt(campaignProspectAssignments.assignedAt, input.cursor.assignedAt),

        and(
          eq(campaignProspectAssignments.assignedAt, input.cursor.assignedAt),

          lt(campaignProspectAssignments.id, input.cursor.assignmentId),
        ),
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select({
        campaignProspectId: campaignProspects.id,

        lifecycleStage: campaignProspects.lifecycleStage,

        campaign: {
          id: campaigns.id,

          name: campaigns.name,
        },

        assignment: {
          id: campaignProspectAssignments.id,

          organizationId: campaignProspectAssignments.organizationId,

          teamId: campaignProspectAssignments.teamId,

          assignedAt: campaignProspectAssignments.assignedAt,
        },

        establishment: {
          id: establishments.id,

          regionId: establishments.regionId,

          name: establishments.name,

          addressLine1: establishments.addressLine1,

          postalCode: establishments.postalCode,

          city: establishments.city,

          countryCode: establishments.countryCode,

          /*
           * Canonical coordinates, already stored on the establishment.
           * Exposed so an assigned prospector can plot their own portfolio;
           * the PostGIS `location` point stays server-side.
           */
          latitude: establishments.latitude,

          longitude: establishments.longitude,

          phone: establishments.phone,

          website: establishments.website,

          status: establishments.status,
        },
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,

        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),

          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),

          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,

        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),

          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .innerJoin(
        establishments,

        and(
          eq(campaignProspects.tenantId, establishments.tenantId),

          eq(campaignProspects.establishmentId, establishments.id),
        ),
      )
      .where(and(...conditions))
      .orderBy(
        desc(campaignProspectAssignments.assignedAt),

        desc(campaignProspectAssignments.id),
      )
      /*
       * Fetch one extra row.
       *
       * The service layer will use this to determine
       * whether another cursor page exists.
       */
      .limit(input.limit + 1);

    const [latestActivities, nextFollowUps] = await Promise.all([
      this.findLatestActivities(
        input.tenantId,

        rows.map((row) => row.campaignProspectId),
      ),

      this.findNextFollowUps(
        input.tenantId,

        input.userId,

        rows.map((row) => ({
          campaignId: row.campaign.id,

          campaignProspectId: row.campaignProspectId,

          assignmentId: row.assignment.id,
        })),
      ),
    ]);

    return rows.map((row) => ({
      ...row,

      latestActivity: latestActivities.get(row.campaignProspectId) ?? null,

      nextFollowUp: nextFollowUps.get(row.campaignProspectId) ?? null,
    }));
  }

  async findAssignedProspectById(
    input: FindWorkQueueProspectDetailInput,
  ): Promise<WorkQueueProspectDetail | null> {
    /*
     * This is deliberately a single scoped lookup.
     *
     * We do not:
     *
     * 1. find the prospect globally,
     * 2. then separately check ownership.
     *
     * Tenant, user, team, campaign, prospect, and
     * current-assignment ownership are all part of
     * the database predicate itself.
     */
    const [detail] = await this.database
      .select({
        campaignProspectId: campaignProspects.id,

        lifecycleStage: campaignProspects.lifecycleStage,

        campaign: {
          id: campaigns.id,

          name: campaigns.name,
        },

        assignment: {
          id: campaignProspectAssignments.id,

          organizationId: campaignProspectAssignments.organizationId,

          teamId: campaignProspectAssignments.teamId,

          assignedAt: campaignProspectAssignments.assignedAt,
        },

        establishment: {
          id: establishments.id,

          regionId: establishments.regionId,

          name: establishments.name,

          addressLine1: establishments.addressLine1,

          postalCode: establishments.postalCode,

          city: establishments.city,

          countryCode: establishments.countryCode,

          latitude: establishments.latitude,

          longitude: establishments.longitude,

          phone: establishments.phone,

          website: establishments.website,

          status: establishments.status,
        },
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,

        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),

          eq(campaignProspectAssignments.campaignId, campaignProspects.campaignId),

          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,

        and(
          eq(campaignProspectAssignments.tenantId, campaigns.tenantId),

          eq(campaignProspectAssignments.campaignId, campaigns.id),
        ),
      )
      .innerJoin(
        establishments,

        and(
          eq(campaignProspects.tenantId, establishments.tenantId),

          eq(campaignProspects.establishmentId, establishments.id),
        ),
      )
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, input.tenantId),

          /*
           * Prospect Detail is a personal Prospector
           * operational screen.
           *
           * The caller must own the current assignment.
           */
          eq(campaignProspectAssignments.assignedUserId, input.userId),

          eq(campaignProspectAssignments.teamId, input.teamId),

          eq(campaignProspectAssignments.campaignId, input.campaignId),

          eq(campaignProspectAssignments.campaignProspectId, input.campaignProspectId),

          /*
           * An ended assignment is no longer part of
           * the caller's active Work Queue.
           */
          isNull(campaignProspectAssignments.endedAt),

          /*
           * Detail semantics intentionally match the
           * Work Queue inclusion rules.
           */
          eq(campaigns.status, 'active'),

          eq(campaignProspects.status, 'active'),
        ),
      )
      .limit(1);

    if (!detail) {
      return null;
    }

    const latestActivities = await this.findLatestActivities(input.tenantId, [
      detail.campaignProspectId,
    ]);

    return {
      ...detail,

      latestActivity: latestActivities.get(detail.campaignProspectId) ?? null,
    };
  }

  private async findLatestActivities(
    tenantId: string,
    campaignProspectIds: string[],
  ): Promise<Map<string, WorkQueueLatestActivity>> {
    const uniqueProspectIds = [...new Set(campaignProspectIds)];

    if (uniqueProspectIds.length === 0) {
      return new Map();
    }

    const rows = await this.database
      .selectDistinctOn([prospectActivities.campaignProspectId], {
        campaignProspectId: prospectActivities.campaignProspectId,

        type: prospectActivities.type,

        occurredAt: prospectActivities.occurredAt,

        createdAt: prospectActivities.createdAt,

        id: prospectActivities.id,
      })
      .from(prospectActivities)
      .where(
        and(
          eq(prospectActivities.tenantId, tenantId),

          inArray(prospectActivities.campaignProspectId, uniqueProspectIds),
        ),
      )
      .orderBy(
        prospectActivities.campaignProspectId,

        desc(prospectActivities.occurredAt),

        desc(prospectActivities.createdAt),

        desc(prospectActivities.id),
      );

    return new Map(
      rows.map((row) => [
        row.campaignProspectId,

        {
          type: row.type,

          occurredAt: row.occurredAt,
        },
      ]),
    );
  }

  private async findNextFollowUps(
    tenantId: string,
    userId: string,
    targets: WorkQueueFollowUpTarget[],
  ): Promise<Map<string, WorkQueueNextFollowUp>> {
    if (targets.length === 0) {
      return new Map();
    }

    const targetCondition = or(
      ...targets.map((target) =>
        and(
          eq(prospectFollowUps.campaignId, target.campaignId),

          eq(prospectFollowUps.campaignProspectId, target.campaignProspectId),

          eq(prospectFollowUps.assignmentId, target.assignmentId),
        ),
      ),
    );

    if (!targetCondition) {
      return new Map();
    }

    const rows = await this.database
      .selectDistinctOn([prospectFollowUps.campaignProspectId], {
        campaignProspectId: prospectFollowUps.campaignProspectId,

        id: prospectFollowUps.id,

        dueAt: prospectFollowUps.dueAt,
      })
      .from(prospectFollowUps)
      .where(
        and(
          eq(prospectFollowUps.tenantId, tenantId),

          eq(prospectFollowUps.status, 'pending'),

          or(
            eq(prospectFollowUps.assignedUserId, userId),

            isNull(prospectFollowUps.assignedUserId),
          ),

          targetCondition,
        ),
      )
      .orderBy(
        prospectFollowUps.campaignProspectId,

        asc(prospectFollowUps.dueAt),

        asc(prospectFollowUps.id),
      );

    return new Map(
      rows.map((row) => [
        row.campaignProspectId,

        {
          id: row.id,

          dueAt: row.dueAt,
        },
      ]),
    );
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
