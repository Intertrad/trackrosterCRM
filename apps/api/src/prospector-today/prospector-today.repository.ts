import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lt, or, sql } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { establishments } from '../database/schema/establishments.js';
import {
  prospectFollowUps,
  type ProspectFollowUpCategory,
  type ProspectFollowUpChannel,
} from '../database/schema/prospect-follow-ups.js';
import type { ProspectorTodaySummary } from './prospector-today.types.js';

const PRIORITY_LIMIT = 25;

export interface FindProspectorTodayInput {
  tenantId: string;

  organizationId: string;

  teamId: string;

  userId: string;

  now: Date;

  /** Start of the caller's local day; bounds the completed-today count. */
  startsAt: Date;

  endsAt: Date;
}

export interface ProspectorTodayRepositoryPriority {
  id: string;

  campaignId: string;

  campaignProspectId: string;

  dueAt: Date;

  category: ProspectFollowUpCategory;

  channel: ProspectFollowUpChannel | null;

  establishment: {
    id: string;

    name: string;

    city: string | null;

    latitude: string | number | null;

    longitude: string | number | null;
  };
}

export interface ProspectorTodayRepositoryResult {
  summary: ProspectorTodaySummary;

  priorities: ProspectorTodayRepositoryPriority[];
}

@Injectable()
export class ProspectorTodayRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findToday(input: FindProspectorTodayInput): Promise<ProspectorTodayRepositoryResult> {
    /*
     * Summary and rows are deliberately separate queries.
     *
     * The aggregate must describe the full workload while the detail list is
     * capped for a predictable dashboard payload. Joining an aggregate onto
     * the limited list would make an empty priority page lose its summary.
     */
    const summaryQuery = this.database
      .select({
        actionsLeft: sql<number>`count(*)`.mapWith(Number),

        toDo: sql<number>`
          count(*)
          filter (
            where
              ${gte(prospectFollowUps.dueAt, input.now)}
              and ${eq(prospectFollowUps.category, 'todo')}
          )
        `.mapWith(Number),

        followUps: sql<number>`
          count(*)
          filter (
            where
              ${gte(prospectFollowUps.dueAt, input.now)}
              and ${eq(prospectFollowUps.category, 'follow_up')}
          )
        `.mapWith(Number),

        meetings: sql<number>`
          count(*)
          filter (
            where
              ${gte(prospectFollowUps.dueAt, input.now)}
              and ${eq(prospectFollowUps.category, 'meeting')}
          )
        `.mapWith(Number),

        overdue: sql<number>`
          count(*)
          filter (
            where
              ${lt(prospectFollowUps.dueAt, input.now)}
          )
        `.mapWith(Number),
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),
          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
          eq(prospectFollowUps.campaignId, campaignProspectAssignments.campaignId),
          eq(prospectFollowUps.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),
          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),
          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
          eq(prospectFollowUps.establishmentId, campaignProspects.establishmentId),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),
          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(this.buildScopeCondition(input));

    const prioritiesQuery = this.database
      .select({
        id: prospectFollowUps.id,

        campaignId: prospectFollowUps.campaignId,

        campaignProspectId: prospectFollowUps.campaignProspectId,

        dueAt: prospectFollowUps.dueAt,

        category: prospectFollowUps.category,

        channel: prospectFollowUps.channel,

        establishment: {
          id: establishments.id,

          name: establishments.name,

          city: establishments.city,

          /*
           * Needed to plot the day's visits. Columns already exist on the
           * joined row, so this adds no query cost; a prospect without
           * coordinates simply does not appear on the map.
           */
          latitude: establishments.latitude,

          longitude: establishments.longitude,
        },
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),
          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
          eq(prospectFollowUps.campaignId, campaignProspectAssignments.campaignId),
          eq(prospectFollowUps.campaignProspectId, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),
          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),
          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
          eq(prospectFollowUps.establishmentId, campaignProspects.establishmentId),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),
          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .innerJoin(
        establishments,
        and(
          eq(prospectFollowUps.tenantId, establishments.tenantId),
          eq(prospectFollowUps.establishmentId, establishments.id),
        ),
      )
      .where(this.buildScopeCondition(input))
      .orderBy(asc(prospectFollowUps.dueAt), asc(prospectFollowUps.id))
      .limit(PRIORITY_LIMIT);

    /*
     * Completed work needs its own query: the shared scope condition pins
     * status to 'pending', so a completed follow-up is invisible to the
     * summary above by construction.
     */
    const completedQuery = this.database
      .select({ completedToday: sql<number>`count(*)`.mapWith(Number) })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),
          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .where(
        and(
          eq(prospectFollowUps.tenantId, input.tenantId),
          eq(prospectFollowUps.status, 'completed'),
          gte(prospectFollowUps.completedAt, input.startsAt),
          lt(prospectFollowUps.completedAt, input.endsAt),
          eq(campaignProspectAssignments.organizationId, input.organizationId),
          eq(campaignProspectAssignments.teamId, input.teamId),
          isNull(campaignProspectAssignments.endedAt),
          or(
            eq(prospectFollowUps.assignedUserId, input.userId),
            isNull(prospectFollowUps.assignedUserId),
          ),
        ),
      );

    const [[summary], priorities, [completed]] = await Promise.all([
      summaryQuery,
      prioritiesQuery,
      completedQuery,
    ]);

    return {
      summary: {
        ...(summary ?? {
          actionsLeft: 0,
          toDo: 0,
          followUps: 0,
          meetings: 0,
          overdue: 0,
        }),
        completedToday: completed?.completedToday ?? 0,
      },
      priorities,
    };
  }

  private buildScopeCondition(input: FindProspectorTodayInput) {
    return and(
      eq(prospectFollowUps.tenantId, input.tenantId),
      eq(prospectFollowUps.status, 'pending'),
      lt(prospectFollowUps.dueAt, input.endsAt),

      eq(campaignProspectAssignments.tenantId, input.tenantId),
      eq(campaignProspectAssignments.organizationId, input.organizationId),
      eq(campaignProspectAssignments.teamId, input.teamId),
      isNull(campaignProspectAssignments.endedAt),

      /*
       * A shared follow-up does not make another prospector's personal
       * assignment actionable. The current assignment must also belong to
       * the caller or to the team.
       */
      or(
        eq(campaignProspectAssignments.assignedUserId, input.userId),
        isNull(campaignProspectAssignments.assignedUserId),
      ),

      eq(campaignProspects.status, 'active'),
      eq(campaigns.status, 'active'),

      /*
       * Null ownership is intentional shared team work. It is included in
       * both the summary and the priority list for every eligible prospector
       * in this exact workspace.
       */
      or(
        eq(prospectFollowUps.assignedUserId, input.userId),
        isNull(prospectFollowUps.assignedUserId),
      ),
    );
  }
}

export { PRIORITY_LIMIT };
