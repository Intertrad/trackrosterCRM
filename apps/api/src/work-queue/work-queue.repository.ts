import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, lt, or, type SQL } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { establishments } from '../database/schema/establishments.js';
import type { WorkQueueItem, WorkQueueProspectDetail } from './work-queue.types.js';

export interface FindWorkQueueInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId?: string;

  search?: string;

  limit: number;

  cursor?: {
    assignedAt: Date;

    assignmentId: string;
  };
}

export interface FindWorkQueueProspectDetailInput {
  tenantId: string;

  userId: string;

  teamId: string;

  campaignId: string;

  campaignProspectId: string;
}

@Injectable()
export class WorkQueueRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

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

    return (
      this.database
        .select({
          campaignProspectId: campaignProspects.id,

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
        .limit(input.limit + 1)
    );
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

    return detail ?? null;
  }

  private escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}
