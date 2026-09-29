import { Inject, Injectable } from '@nestjs/common';
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

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../database/schema/campaign-prospects.js';
import { campaigns } from '../database/schema/campaigns.js';
import { prospectActivities } from '../database/schema/prospect-activities.js';
import { prospectFollowUps } from '../database/schema/prospect-follow-ups.js';
import { addAssignmentScopeConditions } from './report-scope.js';
import { STAGE_WEIGHTS, type LifecycleStage } from './report-query.constants.js';
import { buildFunnelStages, completeness, rate } from './report-math.js';
import type { ManagerDashboardReportInput } from './manager-dashboard.types.js';

function toInt(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Real per-report queries.
 *
 * Every one of these carries {@link addAssignmentScopeConditions}, so a
 * manager sees their team and a director their organization — the same
 * authority the dashboard enforces.
 *
 * Reports whose subject has no team of its own (an establishment, a
 * territory) are reached *through* an assignment rather than queried
 * directly, so scoping still applies. That is why those queries join
 * campaign_prospect_assignments even when they do not select from it.
 */
@Injectable()
export class ReportQueryRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  /* ---------------------------------------------------------------- funnel */

  async funnel(input: ManagerDashboardReportInput) {
    const conditions: SQL[] = [
      eq(campaignProspects.tenantId, input.tenantId),
      eq(campaignProspects.status, 'active'),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspects.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({ stage: campaignProspects.lifecycleStage, total: count() })
      .from(campaignProspects)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
          isNull(campaignProspectAssignments.endedAt),
        ),
      )
      .where(and(...conditions))
      .groupBy(campaignProspects.lifecycleStage);

    return buildFunnelStages(new Map(rows.map((row) => [row.stage as string, toInt(row.total)])));
  }

  /* ----------------------------------------------------------- conversions */

  async conversions(input: ManagerDashboardReportInput) {
    const { total, stages } = await this.funnel(input);

    const find = (stage: LifecycleStage) => stages.find((row) => row.stage === stage)?.total ?? 0;

    const contacted = total - find('to_contact');
    const qualified = find('qualified') + find('converted');
    const converted = find('converted');

    return {
      total,
      contacted,
      qualified,
      converted,
      contactRate: rate(contacted, total),
      qualificationRate: rate(qualified, contacted),
      conversionRate: rate(converted, contacted),
    };
  }

  /* --------------------------------------------------------------- actions */

  async actions(input: ManagerDashboardReportInput) {
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

    const byType = await this.database
      .select({ type: prospectActivities.type, total: count() })
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

    /* Outcomes live on the actions table, which is keyed by membership. */
    const outcomes = await this.database.execute<{ outcome_code: string; total: number }>(
      sql`SELECT o.outcome_code, count(*)::int AS total
          FROM action_outcomes o
          JOIN actions a ON a.tenant_id = o.tenant_id AND a.id = o.action_id
          JOIN campaign_prospect_assignments cpa
            ON cpa.tenant_id = a.tenant_id AND cpa.id = a.assignment_id
          WHERE o.tenant_id = ${input.tenantId}
            AND o.recorded_at >= ${input.range.from}
            AND o.recorded_at < ${input.range.to}
            ${input.scope.organizationId ? sql`AND cpa.organization_id = ${input.scope.organizationId}` : sql``}
            ${input.scope.teamId ? sql`AND cpa.team_id = ${input.scope.teamId}` : sql``}
            ${input.filters.organizationId ? sql`AND cpa.organization_id = ${input.filters.organizationId}` : sql``}
            ${input.filters.teamId ? sql`AND cpa.team_id = ${input.filters.teamId}` : sql``}
            ${input.filters.campaignId ? sql`AND a.campaign_id = ${input.filters.campaignId}` : sql``}
          GROUP BY o.outcome_code`,
    );

    const total = byType.reduce((sum, row) => sum + toInt(row.total), 0);

    return {
      total,
      byType: Object.fromEntries(byType.map((row) => [row.type as string, toInt(row.total)])),
      byOutcome: Object.fromEntries(
        outcomes.rows.map((row) => [row.outcome_code, toInt(row.total)]),
      ),
    };
  }

  /* ------------------------------------------------------------ follow-ups */

  async followUps(input: ManagerDashboardReportInput) {
    const conditions: SQL[] = [eq(prospectFollowUps.tenantId, input.tenantId)];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.userId) {
      conditions.push(eq(prospectFollowUps.assignedUserId, input.filters.userId));
    }

    if (input.filters.campaignId) {
      conditions.push(eq(prospectFollowUps.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({
        status: prospectFollowUps.status,
        total: count(),
        overdue: sql<number>`count(*) FILTER (
          WHERE ${prospectFollowUps.status} = 'pending'
            AND ${prospectFollowUps.dueAt} < ${input.generatedAt}
        )::int`,
      })
      .from(prospectFollowUps)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(prospectFollowUps.tenantId, campaignProspectAssignments.tenantId),
          eq(prospectFollowUps.assignmentId, campaignProspectAssignments.id),
        ),
      )
      .where(and(...conditions))
      .groupBy(prospectFollowUps.status);

    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status as string, toInt(row.total)]),
    );

    const total = rows.reduce((sum, row) => sum + toInt(row.total), 0);
    const overdue = rows.reduce((sum, row) => sum + toInt(row.overdue), 0);
    const completed = byStatus.completed ?? 0;

    return {
      total,
      overdue,
      byStatus,
      completionRate: rate(completed, total),
    };
  }

  /* -------------------------------------------------------------- workload */

  async workload(input: ManagerDashboardReportInput) {
    const conditions: SQL[] = [
      eq(campaignProspectAssignments.tenantId, input.tenantId),
      isNull(campaignProspectAssignments.endedAt),
      eq(campaignProspects.status, 'active'),
      eq(campaigns.status, 'active'),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspectAssignments.campaignId, input.filters.campaignId));
    }

    const rows = await this.database
      .select({
        userId: campaignProspectAssignments.assignedUserId,
        total: count(),
        paused: sql<number>`count(*) FILTER (
          WHERE ${campaignProspectAssignments.status} = 'paused'
        )::int`,
      })
      .from(campaignProspectAssignments)
      .innerJoin(
        campaignProspects,
        and(
          eq(campaignProspects.tenantId, campaignProspectAssignments.tenantId),
          eq(campaignProspects.id, campaignProspectAssignments.campaignProspectId),
        ),
      )
      .innerJoin(
        campaigns,
        and(
          eq(campaigns.tenantId, campaignProspectAssignments.tenantId),
          eq(campaigns.id, campaignProspectAssignments.campaignId),
        ),
      )
      .where(and(...conditions))
      .groupBy(campaignProspectAssignments.assignedUserId);

    /* A null assignedUserId is a team-owned assignment, not a person. */
    const assigned = rows.filter((row) => row.userId !== null);
    const teamOwned = rows.find((row) => row.userId === null);

    return {
      teamOwned: toInt(teamOwned?.total),
      byProspector: assigned.map((row) => ({
        userId: row.userId as string,
        assigned: toInt(row.total),
        paused: toInt(row.paused),
      })),
    };
  }

  /* -------------------------------------------------------------- coverage */

  async coverage(input: ManagerDashboardReportInput) {
    const conditions: SQL[] = [
      eq(campaignProspects.tenantId, input.tenantId),
      eq(campaignProspects.status, 'active'),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspects.campaignId, input.filters.campaignId));
    }

    const [row] = await this.database
      .select({
        prospects: countDistinct(campaignProspects.id),
        establishments: countDistinct(campaignProspects.establishmentId),
        touched: sql<number>`count(DISTINCT ${campaignProspects.id}) FILTER (
          WHERE ${campaignProspects.lifecycleStage} <> 'to_contact'
        )::int`,
      })
      .from(campaignProspects)
      .innerJoin(
        campaignProspectAssignments,
        and(
          eq(campaignProspectAssignments.tenantId, campaignProspects.tenantId),
          eq(campaignProspectAssignments.campaignProspectId, campaignProspects.id),
          isNull(campaignProspectAssignments.endedAt),
        ),
      )
      .where(and(...conditions));

    const prospects = toInt(row?.prospects);
    const touched = toInt(row?.touched);

    return {
      prospects,
      establishments: toInt(row?.establishments),
      touched,
      untouched: Math.max(0, prospects - touched),
      coverageRate: rate(touched, prospects),
    };
  }

  /* ------------------------------------------------------------ collisions */

  async collisions(input: ManagerDashboardReportInput) {
    const result = await this.database.execute<{
      decision: string;
      reason_code: string;
      total: number;
    }>(
      sql`SELECT c.decision, c.reason_code, count(*)::int AS total
          FROM collision_events c
          JOIN campaign_prospect_assignments cpa
            ON cpa.tenant_id = c.tenant_id AND cpa.id = c.assignment_id
          WHERE c.tenant_id = ${input.tenantId}
            AND c.created_at >= ${input.range.from}
            AND c.created_at < ${input.range.to}
            ${input.scope.organizationId ? sql`AND cpa.organization_id = ${input.scope.organizationId}` : sql``}
            ${input.scope.teamId ? sql`AND cpa.team_id = ${input.scope.teamId}` : sql``}
            ${input.filters.organizationId ? sql`AND cpa.organization_id = ${input.filters.organizationId}` : sql``}
            ${input.filters.teamId ? sql`AND cpa.team_id = ${input.filters.teamId}` : sql``}
            ${input.filters.campaignId ? sql`AND c.campaign_id = ${input.filters.campaignId}` : sql``}
          GROUP BY c.decision, c.reason_code`,
    );

    const byDecision: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    let total = 0;

    for (const row of result.rows) {
      const value = toInt(row.total);

      total += value;
      byDecision[row.decision] = (byDecision[row.decision] ?? 0) + value;
      byReason[row.reason_code] = (byReason[row.reason_code] ?? 0) + value;
    }

    return { total, byDecision, byReason };
  }

  /* ----------------------------------------------------------- territories */

  async territories(input: ManagerDashboardReportInput) {
    const result = await this.database.execute<{
      territory_id: string;
      name: string;
      code: string | null;
      prospects: number;
      activities: number;
    }>(
      sql`SELECT t.id AS territory_id, t.name, t.code,
                 count(DISTINCT cp.id)::int AS prospects,
                 count(DISTINCT pa.id)::int AS activities
          FROM territories t
          JOIN territory_assignments ta
            ON ta.tenant_id = t.tenant_id AND ta.territory_id = t.id
          JOIN campaign_prospect_assignments cpa
            ON cpa.tenant_id = t.tenant_id AND cpa.team_id = ta.team_id
           AND cpa.ended_at IS NULL
          JOIN campaign_prospects cp
            ON cp.tenant_id = cpa.tenant_id AND cp.id = cpa.campaign_prospect_id
          LEFT JOIN prospect_activities pa
            ON pa.tenant_id = cpa.tenant_id AND pa.assignment_id = cpa.id
           AND pa.occurred_at >= ${input.range.from} AND pa.occurred_at < ${input.range.to}
          WHERE t.tenant_id = ${input.tenantId}
            AND t.status = 'active'
            ${input.scope.organizationId ? sql`AND cpa.organization_id = ${input.scope.organizationId}` : sql``}
            ${input.scope.teamId ? sql`AND cpa.team_id = ${input.scope.teamId}` : sql``}
            ${input.filters.organizationId ? sql`AND cpa.organization_id = ${input.filters.organizationId}` : sql``}
            ${input.filters.teamId ? sql`AND cpa.team_id = ${input.filters.teamId}` : sql``}
            ${input.filters.campaignId ? sql`AND cpa.campaign_id = ${input.filters.campaignId}` : sql``}
          GROUP BY t.id, t.name, t.code
          ORDER BY prospects DESC
          LIMIT 200`,
    );

    return {
      items: result.rows.map((row) => ({
        territoryId: row.territory_id,
        name: row.name,
        code: row.code,
        prospects: toInt(row.prospects),
        activities: toInt(row.activities),
      })),
    };
  }

  /* ---------------------------------------------------------- data quality */

  async dataQuality(input: ManagerDashboardReportInput) {
    const conditions: SQL[] = [
      eq(campaignProspects.tenantId, input.tenantId),
      eq(campaignProspects.status, 'active'),
    ];

    addAssignmentScopeConditions(conditions, input);

    if (input.filters.campaignId) {
      conditions.push(eq(campaignProspects.campaignId, input.filters.campaignId));
    }

    const result = await this.database.execute<{
      total: number;
      missing_phone: number;
      missing_coordinates: number;
      missing_address: number;
      missing_website: number;
    }>(
      sql`SELECT count(DISTINCT e.id)::int AS total,
                 count(DISTINCT e.id) FILTER (WHERE e.phone IS NULL)::int AS missing_phone,
                 count(DISTINCT e.id) FILTER (WHERE e.latitude IS NULL OR e.longitude IS NULL)::int AS missing_coordinates,
                 count(DISTINCT e.id) FILTER (WHERE e.address_line1 IS NULL)::int AS missing_address,
                 count(DISTINCT e.id) FILTER (WHERE e.website IS NULL)::int AS missing_website
          FROM establishments e
          JOIN campaign_prospects cp
            ON cp.tenant_id = e.tenant_id AND cp.establishment_id = e.id
           AND cp.status = 'active'
          JOIN campaign_prospect_assignments cpa
            ON cpa.tenant_id = cp.tenant_id AND cpa.campaign_prospect_id = cp.id
           AND cpa.ended_at IS NULL
          WHERE e.tenant_id = ${input.tenantId}
            ${input.scope.organizationId ? sql`AND cpa.organization_id = ${input.scope.organizationId}` : sql``}
            ${input.scope.teamId ? sql`AND cpa.team_id = ${input.scope.teamId}` : sql``}
            ${input.filters.organizationId ? sql`AND cpa.organization_id = ${input.filters.organizationId}` : sql``}
            ${input.filters.teamId ? sql`AND cpa.team_id = ${input.filters.teamId}` : sql``}
            ${input.filters.campaignId ? sql`AND cp.campaign_id = ${input.filters.campaignId}` : sql``}`,
    );

    const row = result.rows[0];
    const total = toInt(row?.total);

    const missing = {
      phone: toInt(row?.missing_phone),
      coordinates: toInt(row?.missing_coordinates),
      address: toInt(row?.missing_address),
      website: toInt(row?.missing_website),
    };

    return { total, missing, completeness: completeness(total, missing) };
  }

  /* -------------------------------------------------------------- forecast */

  async forecast(input: ManagerDashboardReportInput) {
    const { stages, total } = await this.funnel(input);

    const weighted = stages.reduce(
      (sum, row) => sum + row.total * (STAGE_WEIGHTS[row.stage] ?? 0),
      0,
    );

    const scheduled = await this.database
      .select({ total: count() })
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
          eq(prospectFollowUps.status, 'pending'),
          isNotNull(prospectFollowUps.dueAt),
          gte(prospectFollowUps.dueAt, input.generatedAt),
          ...(() => {
            const conditions: SQL[] = [];

            addAssignmentScopeConditions(conditions, input);

            return conditions;
          })(),
        ),
      );

    return {
      pipeline: total,
      weightedPipeline: Math.round(weighted * 10) / 10,
      scheduledFollowUps: toInt(scheduled[0]?.total),
      basis: 'Straight-line stage weighting; no historical conversion model is recorded',
    };
  }
}
