import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
import { REPORT_KEYS, ReportQueryService, type ReportKey } from './report-query.service.js';

const definitions = REPORT_KEYS.map((key) => ({
  id: key,
  key,
  version: 1,
  supportedFilters: ['from', 'to', 'organizationId', 'teamId', 'userId', 'campaignId'],
}));

@Controller()
@UseGuards(AuthGuard)
export class ReportController {
  constructor(
    private readonly dashboard: ManagerDashboardService,
    private readonly reports: ReportQueryService,
  ) {}

  @Get('report-definitions') definitions() {
    return { items: definitions };
  }

  /*
   * A report addressed by id is the saved-definition path. Until stored
   * definitions exist it answers with the overview, which is the only report
   * that needs no parameters of its own.
   */
  @Get('reports/:reportId([0-9a-fA-F-]{36})') report(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reportId', ParseUUIDPipe) _id: string,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.dashboard.getDashboard({ tenantId: a.tenantId, userId: a.membershipId, query: q });
  }

  @Get('reports/overview') overview(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'overview');
  }

  @Get('reports/workload') workload(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'workload');
  }

  @Get('reports/actions') actions(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'actions');
  }

  @Get('reports/funnel') funnel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'funnel');
  }

  @Get('reports/conversions') conversions(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'conversions');
  }

  @Get('reports/follow-ups') followups(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'follow-ups');
  }

  @Get('reports/coverage') coverage(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'coverage');
  }

  @Get('reports/collisions') collisions(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'collisions');
  }

  @Get('reports/data-quality') quality(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'data-quality');
  }

  @Get('reports/territories') territories(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'territories');
  }

  @Get('reports/forecast') forecast(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.run(a, q, 'forecast');
  }

  private run(a: AuthenticatedPrincipal, q: ManagerDashboardQueryDto, report: ReportKey) {
    return this.reports.run(report, {
      tenantId: a.tenantId,
      userId: a.membershipId,
      query: q,
    });
  }
}
