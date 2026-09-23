import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import { addAssignmentScopeConditions } from './report-scope.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { prospectActivities } from '../database/schema/prospect-activities.js';
import { prospectFollowUps } from '../database/schema/prospect-follow-ups.js';
import type {
  ManagerDashboardActivitySummary,
  ManagerDashboardAssignmentSummary,
  ManagerDashboardFollowUpSummary,
  ManagerDashboardReportInput,
} from './manager-dashboard.types.js';

export interface ManagerDashboardProspectorActivityRow {
  userId: string;

  activities: number;
}

export interface ManagerDashboardProspectorAssignmentRow {
  userId: string;

  currentAssignments: number;
}

export interface ManagerDashboardProspectorFollowUpRow {
  userId: string;

  pendingFollowUps: number;

  overdueFollowUps: number;
}

@Injectable()
export class ManagerDashboardRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  /*
   * -------------------------------------------------
   * ACTIVITY SUMMARY
   * -------------------------------------------------
   *
   * Activities are historical period metrics.
   *
   * We scope an activity through the assignment
   * under which it was recorded.
   *
   * This is important:
   *
   * an activity from last week should remain owned
   * by the organization/team that actually performed
   * it even if the prospect is reassigned later.
   */
  async getActivitySummary(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardActivitySummary> {
    const conditions = this.buildActivityConditions(input);

    const groupedByType = await this.database
      .select({
        type: prospectActivities.type,

        total: count(),
      })
      .from(prospectActivities)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectActivities.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectActivities.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .where(and(...conditions))
      .groupBy(prospectActivities.type);

    const [activeProspectorResult] = await this.database
      .select({
        total: countDistinct(prospectActivities.userId),
      })
      .from(prospectActivities)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectActivities.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectActivities.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .where(and(...conditions));

    const byType: Record<string, number> = {};

    let total = 0;

    for (const row of groupedByType) {
      byType[row.type] = row.total;

      total += row.total;
    }

    return {
      total,

      byType,

      activeProspectors: activeProspectorResult?.total ?? 0,
    };
  }

  /*
   * -------------------------------------------------
   * ASSIGNMENT SUMMARY
   * -------------------------------------------------
   *
   * Assignment metrics are a CURRENT snapshot.
   *
   * They intentionally do not use the dashboard
   * from/to period.
   *
   * Current actionable workload means:
   *
   * - assignment endedAt IS NULL
   * - campaign is active
   * - campaign prospect is active
   */
  async getAssignmentSummary(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardAssignmentSummary> {
    const conditions = this.buildCurrentAssignmentConditions(input);

    const [result] = await this.database
      .select({
        current: count(),

        individuallyAssigned: sql<number>`
              count(*)
              filter (
                where
                  ${isNotNull(campaignProspectAssignments.assignedUserId)}
              )
            `.mapWith(Number),

        teamOwned: sql<number>`
              count(*)
              filter (
                where
                  ${isNull(campaignProspectAssignments.assignedUserId)}
              )
            `.mapWith(Number),
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
      .where(and(...conditions));

    return {
      current: result?.current ?? 0,

      individuallyAssigned: result?.individuallyAssigned ?? 0,

      teamOwned: result?.teamOwned ?? 0,
    };
  }

  /*
   * -------------------------------------------------
   * FOLLOW-UP SUMMARY
   * -------------------------------------------------
   *
   * Follow-ups intentionally mix:
   *
   * CURRENT snapshot metrics:
   *
   * - pending
   * - overdue
   *
   * PERIOD metrics:
   *
   * - dueInRange
   * - completedInRange
   * - cancelledInRange
   *
   * Pending metrics require the current assignment
   * and an active campaign/prospect.
   *
   * Completed/cancelled history does NOT require the
   * assignment to still be current. Historical work
   * must remain reportable after reassignment.
   */
  async getFollowUpSummary(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardFollowUpSummary> {
    const baseConditions = this.buildFollowUpScopeConditions(input);

    const pendingCondition = and(
      eq(prospectFollowUps.status, 'pending'),

      isNull(campaignProspectAssignments.endedAt),

      eq(campaignProspects.status, 'active'),

      eq(campaigns.status, 'active'),
    );

    const [result] = await this.database
      .select({
        pending: sql<number>`
              count(*)
              filter (
                where
                  ${pendingCondition}
              )
            `.mapWith(Number),

        overdue: sql<number>`
              count(*)
              filter (
                where
                  ${and(
                    pendingCondition,

                    lt(prospectFollowUps.dueAt, input.generatedAt),
                  )}
              )
            `.mapWith(Number),

        dueInRange: sql<number>`
              count(*)
              filter (
                where
                  ${and(
                    pendingCondition,

                    gte(prospectFollowUps.dueAt, input.range.from),

                    lt(prospectFollowUps.dueAt, input.range.to),
                  )}
              )
            `.mapWith(Number),

        completedInRange: sql<number>`
              count(*)
              filter (
                where
                  ${and(
                    eq(prospectFollowUps.status, 'completed'),

                    isNotNull(prospectFollowUps.completedAt),

                    gte(prospectFollowUps.completedAt, input.range.from),

                    lt(prospectFollowUps.completedAt, input.range.to),
                  )}
              )
            `.mapWith(Number),

        cancelledInRange: sql<number>`
              count(*)
              filter (
                where
                  ${and(
                    eq(prospectFollowUps.status, 'cancelled'),

                    isNotNull(prospectFollowUps.cancelledAt),

                    gte(prospectFollowUps.cancelledAt, input.range.from),

                    lt(prospectFollowUps.cancelledAt, input.range.to),
                  )}
              )
            `.mapWith(Number),
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),

          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),

          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(and(...baseConditions));

    return {
      pending: result?.pending ?? 0,

      overdue: result?.overdue ?? 0,

      dueInRange: result?.dueInRange ?? 0,

      completedInRange: result?.completedInRange ?? 0,

      cancelledInRange: result?.cancelledInRange ?? 0,
    };
  }

  /*
   * -------------------------------------------------
   * ACTIVITY BY PROSPECTOR
   * -------------------------------------------------
   */
  async getActivityByProspector(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardProspectorActivityRow[]> {
    const conditions = this.buildActivityConditions(input);

    const rows = await this.database
      .select({
        userId: prospectActivities.userId,

        activities: count(),
      })
      .from(prospectActivities)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectActivities.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectActivities.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .where(and(...conditions))
      .groupBy(prospectActivities.userId);

    return rows;
  }

  /*
   * -------------------------------------------------
   * CURRENT ASSIGNMENTS BY PROSPECTOR
   * -------------------------------------------------
   *
   * Team-owned assignments are intentionally absent
   * because they cannot truthfully be attributed to
   * a specific prospector.
   */
  async getAssignmentsByProspector(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardProspectorAssignmentRow[]> {
    const conditions = [
      ...this.buildCurrentAssignmentConditions(input),

      isNotNull(campaignProspectAssignments.assignedUserId),
    ];

    const rows = await this.database
      .select({
        userId: campaignProspectAssignments.assignedUserId,

        currentAssignments: count(),
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
      .where(and(...conditions))
      .groupBy(campaignProspectAssignments.assignedUserId);

    const result: ManagerDashboardProspectorAssignmentRow[] = [];

    for (const row of rows) {
      if (!row.userId) {
        continue;
      }

      result.push({
        userId: row.userId,

        currentAssignments: row.currentAssignments,
      });
    }

    return result;
  }

  /*
   * -------------------------------------------------
   * CURRENT FOLLOW-UPS BY PROSPECTOR
   * -------------------------------------------------
   *
   * Team-owned follow-ups are not attributed to an
   * individual prospector.
   */
  async getFollowUpsByProspector(
    input: ManagerDashboardReportInput,
  ): Promise<ManagerDashboardProspectorFollowUpRow[]> {
    const conditions = [
      ...this.buildFollowUpScopeConditions(input),

      eq(prospectFollowUps.status, 'pending'),

      isNull(campaignProspectAssignments.endedAt),

      eq(campaignProspects.status, 'active'),

      eq(campaigns.status, 'active'),

      isNotNull(prospectFollowUps.assignedUserId),
    ];

    const rows = await this.database
      .select({
        userId: prospectFollowUps.assignedUserId,

        pendingFollowUps: count(),

        overdueFollowUps: sql<number>`
              count(*)
              filter (
                where
                  ${lt(prospectFollowUps.dueAt, input.generatedAt)}
              )
            `.mapWith(Number),
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),

          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .innerJoin(
        campaignProspects,
        and(
          eq(prospectFollowUps.tenantId, campaignProspects.tenantId),

          eq(prospectFollowUps.campaignId, campaignProspects.campaignId),

          eq(prospectFollowUps.campaignProspectId, campaignProspects.id),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(prospectFollowUps.tenantId, campaigns.tenantId),

          eq(prospectFollowUps.campaignId, campaigns.id),
        ),
      )
      .where(and(...conditions))
      .groupBy(prospectFollowUps.assignedUserId);

    const result: ManagerDashboardProspectorFollowUpRow[] = [];

    for (const row of rows) {
      if (!row.userId) {
        continue;
      }

      result.push({
        userId: row.userId,

        pendingFollowUps: row.pendingFollowUps,

        overdueFollowUps: row.overdueFollowUps,
      });
    }

    return result;
  }

  /*
   * -------------------------------------------------
   * SHARED CONDITION BUILDERS
   * -------------------------------------------------
   *
   * TR-023-D will validate that request filters are
   * allowed for the authenticated caller.
   *
   * The repository still applies BOTH:
   *
   * - resolved authority scope
   * - requested filters
   *
   * This creates defense in depth.
   *
   * If application authorization were ever wrong,
   * a manager's mandatory team scope is still part
   * of every SQL query.
   */

  private buildActivityConditions(input: ManagerDashboardReportInput): SQL[] {
    const conditions: SQL[] = [
      eq(prospectActivities.tenantId, input.tenantId),

      gte(prospectActivities.occurredAt, input.range.from),

      lt(prospectActivities.occurredAt, input.range.to),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(prospectActivities.userId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(prospectActivities.campaignId, input.filters.campaignId));
    }

    return conditions;
  }

  private buildCurrentAssignmentConditions(input: ManagerDashboardReportInput): SQL[] {
    const conditions: SQL[] = [
      eq(campaignProspectAssignments.tenantId, input.tenantId),

      isNull(campaignProspectAssignments.endedAt),

      eq(campaignProspects.status, 'active'),

      eq(campaigns.status, 'active'),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(campaignProspectAssignments.assignedUserId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspectAssignments.campaignId, input.filters.campaignId));
    }

    return conditions;
  }

  private buildFollowUpScopeConditions(input: ManagerDashboardReportInput): SQL[] {
    const conditions: SQL[] = [eq(prospectFollowUps.tenantId, input.tenantId)];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(prospectFollowUps.assignedUserId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(prospectFollowUps.campaignId, input.filters.campaignId));
    }

    return conditions;
  }
}
