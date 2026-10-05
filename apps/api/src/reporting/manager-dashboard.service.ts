import { BadRequestException, Injectable } from '@nestjs/common';

import type { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { MAX_DASHBOARD_RANGE_DAYS } from './manager-dashboard-query.dto.js';
import {
  ManagerDashboardRepository,
  type ManagerDashboardProspectorActivityRow,
  type ManagerDashboardProspectorAssignmentRow,
  type ManagerDashboardProspectorFollowUpRow,
} from './manager-dashboard.repository.js';
import { ManagerDashboardScopeService } from './manager-dashboard-scope.service.js';
import type {
  ManagerDashboardDateRange,
  ManagerDashboardFilters,
  ManagerDashboardProspectorRow,
  ManagerDashboardReportInput,
  ManagerDashboardResponse,
} from './manager-dashboard.types.js';

const DEFAULT_DASHBOARD_RANGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_DASHBOARD_RANGE_MS = MAX_DASHBOARD_RANGE_DAYS * DAY_MS;

export interface GetManagerDashboardInput {
  tenantId: string;

  userId: string;

  query: ManagerDashboardQueryDto;
}

@Injectable()
export class ManagerDashboardService {
  constructor(
    private readonly scopeService: ManagerDashboardScopeService,

    private readonly dashboardRepository: ManagerDashboardRepository,
  ) {}

  async getDashboard(
    input: GetManagerDashboardInput,
    generatedAt: Date = new Date(),
  ): Promise<ManagerDashboardResponse> {
    const range = this.resolveRange(input.query, generatedAt);

    const filters = this.buildFilters(input.query);

    /*
     * Authorization is resolved before any reporting
     * query executes.
     *
     * The repository receives only the server-resolved
     * authority scope plus authorized request filters.
     */
    const scope = await this.scopeService.resolve({
      tenantId: input.tenantId,

      userId: input.userId,

      filters,
    });

    const reportInput: ManagerDashboardReportInput = {
      tenantId: input.tenantId,

      generatedAt,

      range,

      scope,

      filters,
    };

    /*
     * These queries are intentionally independent.
     *
     * Running them separately avoids row multiplication
     * from joining activities × assignments × follow-ups.
     */
    const [
      activities,
      assignments,
      followUps,
      activityByProspector,
      assignmentsByProspector,
      followUpsByProspector,
    ] = await Promise.all([
      this.dashboardRepository.getActivitySummary(reportInput),

      this.dashboardRepository.getAssignmentSummary(reportInput),

      this.dashboardRepository.getFollowUpSummary(reportInput),

      this.dashboardRepository.getActivityByProspector(reportInput),

      this.dashboardRepository.getAssignmentsByProspector(reportInput),

      this.dashboardRepository.getFollowUpsByProspector(reportInput),
    ]);

    return {
      generatedAt: generatedAt.toISOString(),

      range: {
        from: range.from.toISOString(),

        to: range.to.toISOString(),
      },

      scope: {
        authority: scope.authority,

        organizationId: scope.organizationId,

        teamId: scope.teamId,
      },

      filters: {
        organizationId: filters.organizationId ?? null,

        teamId: filters.teamId ?? null,

        userId: filters.userId ?? null,

        campaignId: filters.campaignId ?? null,
      },

      activities,

      assignments,

      followUps,

      byProspector: this.mergeProspectorRows(
        activityByProspector,

        assignmentsByProspector,

        followUpsByProspector,
      ),
    };
  }

  /*
   * -------------------------------------------------
   * DATE RANGE
   * -------------------------------------------------
   *
   * HTTP validation already enforces these rules,
   * but the service defensively checks them because
   * services may also be called internally.
   */

  /* Exposed so per-report queries resolve their window identically. */
  resolveReportRange(
    query: ManagerDashboardQueryDto,
    generatedAt: Date,
  ): ManagerDashboardDateRange {
    return this.resolveRange(query, generatedAt);
  }

  /* Exposed for the same reason as resolveReportRange. */
  buildReportFilters(query: ManagerDashboardQueryDto): ManagerDashboardFilters {
    return this.buildFilters(query);
  }

  private resolveRange(
    query: ManagerDashboardQueryDto,
    generatedAt: Date,
  ): ManagerDashboardDateRange {
    if (query.from === undefined && query.to === undefined) {
      return {
        from: new Date(generatedAt.getTime() - DEFAULT_DASHBOARD_RANGE_DAYS * DAY_MS),

        to: generatedAt,
      };
    }

    if (query.from === undefined || query.to === undefined) {
      throw new BadRequestException('from and to must be supplied together');
    }

    const fromMs = query.from.getTime();

    const toMs = query.to.getTime();

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new BadRequestException('Invalid reporting date range');
    }

    const rangeMs = toMs - fromMs;

    if (rangeMs <= 0) {
      throw new BadRequestException('from must be before to');
    }

    if (rangeMs > MAX_DASHBOARD_RANGE_MS) {
      throw new BadRequestException(
        `Reporting range must not exceed ${MAX_DASHBOARD_RANGE_DAYS} days`,
      );
    }

    return {
      from: query.from,

      to: query.to,
    };
  }

  /*
   * Keep omitted filters truly omitted internally.
   *
   * This is cleaner than constructing:
   *
   * {
   *   organizationId: undefined,
   *   ...
   * }
   */
  private buildFilters(query: ManagerDashboardQueryDto): ManagerDashboardFilters {
    return {
      ...(query.organizationId
        ? {
            organizationId: query.organizationId,
          }
        : {}),

      ...(query.teamId
        ? {
            teamId: query.teamId,
          }
        : {}),

      ...(query.userId
        ? {
            userId: query.userId,
          }
        : {}),

      ...(query.campaignId
        ? {
            campaignId: query.campaignId,
          }
        : {}),
    };
  }

  /*
   * -------------------------------------------------
   * PER-PROSPECTOR MERGE
   * -------------------------------------------------
   *
   * A prospector may exist in any combination of:
   *
   * - period activities
   * - current assignments
   * - pending follow-ups
   *
   * Missing dimensions become zero.
   */
  private mergeProspectorRows(
    activityRows: ManagerDashboardProspectorActivityRow[],

    assignmentRows: ManagerDashboardProspectorAssignmentRow[],

    followUpRows: ManagerDashboardProspectorFollowUpRow[],
  ): ManagerDashboardProspectorRow[] {
    const rows = new Map<string, ManagerDashboardProspectorRow>();

    const requireRow = (userId: string): ManagerDashboardProspectorRow => {
      const existing = rows.get(userId);

      if (existing) {
        return existing;
      }

      const row: ManagerDashboardProspectorRow = {
        userId,

        activities: 0,

        currentAssignments: 0,

        pendingFollowUps: 0,

        overdueFollowUps: 0,
      };

      rows.set(userId, row);

      return row;
    };

    for (const activity of activityRows) {
      const row = requireRow(activity.userId);

      row.activities = activity.activities;
    }

    for (const assignment of assignmentRows) {
      const row = requireRow(assignment.userId);

      row.currentAssignments = assignment.currentAssignments;
    }

    for (const followUp of followUpRows) {
      const row = requireRow(followUp.userId);

      row.pendingFollowUps = followUp.pendingFollowUps;

      row.overdueFollowUps = followUp.overdueFollowUps;

      if (followUp.lateCompletedFollowUps !== undefined) {
        row.lateCompletedFollowUps = followUp.lateCompletedFollowUps;
      }
    }

    /*
     * Deterministic ordering without implying a
     * performance ranking.
     */
    return [...rows.values()].sort((left, right) => left.userId.localeCompare(right.userId));
  }
}

export { DEFAULT_DASHBOARD_RANGE_DAYS };
