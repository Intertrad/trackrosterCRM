import { BadRequestException, Injectable } from '@nestjs/common';

import type { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { ManagerDashboardScopeService } from './manager-dashboard-scope.service.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
import { ReportQueryRepository } from './report-query.repository.js';
import type { ManagerDashboardReportInput } from './manager-dashboard.types.js';

export const REPORT_KEYS = [
  'overview',
  'workload',
  'actions',
  'funnel',
  'conversions',
  'follow-ups',
  'coverage',
  'collisions',
  'data-quality',
  'territories',
  'forecast',
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export interface RunReportInput {
  tenantId: string;
  userId: string;
  query: ManagerDashboardQueryDto;
}

/**
 * Runs one report.
 *
 * Each key resolves to its own query. They previously all returned the same
 * dashboard payload, which meant contact rate, funnel stages and
 * completeness could not be computed at all.
 *
 * `overview` remains the dashboard payload deliberately — that is what an
 * overview is — while every other key now answers its own question.
 */
@Injectable()
export class ReportQueryService {
  constructor(
    private readonly scopeService: ManagerDashboardScopeService,
    private readonly dashboard: ManagerDashboardService,
    private readonly reports: ReportQueryRepository,
  ) {}

  async run(report: ReportKey, input: RunReportInput, generatedAt: Date = new Date()) {
    if (!REPORT_KEYS.includes(report)) {
      throw new BadRequestException(`Unknown report: ${report}`);
    }

    if (report === 'overview') {
      return {
        report,
        definitionVersion: 1,
        ...(await this.dashboard.getDashboard(input, generatedAt)),
      };
    }

    const context = await this.buildContext(input, generatedAt);

    const data = await this.execute(report, context);

    return {
      report,
      definitionVersion: 1,
      generatedAt: generatedAt.toISOString(),
      range: {
        from: context.range.from.toISOString(),
        to: context.range.to.toISOString(),
      },
      scope: {
        authority: context.scope.authority,
        organizationId: context.scope.organizationId,
        teamId: context.scope.teamId,
      },
      filters: context.filters,
      data,
    };
  }

  private execute(report: ReportKey, context: ManagerDashboardReportInput) {
    switch (report) {
      case 'workload':
        return this.reports.workload(context);
      case 'actions':
        return this.reports.actions(context);
      case 'funnel':
        return this.reports.funnel(context);
      case 'conversions':
        return this.reports.conversions(context);
      case 'follow-ups':
        return this.reports.followUps(context);
      case 'coverage':
        return this.reports.coverage(context);
      case 'collisions':
        return this.reports.collisions(context);
      case 'data-quality':
        return this.reports.dataQuality(context);
      case 'territories':
        return this.reports.territories(context);
      case 'forecast':
        return this.reports.forecast(context);
      default:
        throw new BadRequestException(`Unknown report: ${report as string}`);
    }
  }

  /*
   * Range, filters and authority are resolved exactly as the dashboard
   * resolves them. Reusing the dashboard service's own helpers keeps a
   * report from ever being scoped more loosely than the dashboard it sits
   * beside.
   */
  private async buildContext(
    input: RunReportInput,
    generatedAt: Date,
  ): Promise<ManagerDashboardReportInput> {
    const range = this.dashboard.resolveReportRange(input.query, generatedAt);

    const filters = this.dashboard.buildReportFilters(input.query);

    const scope = await this.scopeService.resolve({
      tenantId: input.tenantId,
      userId: input.userId,
      filters,
    });

    return { tenantId: input.tenantId, generatedAt, range, scope, filters };
  }
}
