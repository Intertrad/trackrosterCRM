import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';

const definitions = [
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
].map((key) => ({
  id: key,
  key,
  version: 1,
  supportedFilters: ['from', 'to', 'organizationId', 'teamId', 'userId', 'campaignId'],
}));

@Controller()
@UseGuards(AuthGuard)
export class ReportController {
  constructor(private readonly reports: ManagerDashboardService) {}
  @Get('report-definitions') definitions() {
    return { items: definitions };
  }
  @Get('reports/:reportId([0-9a-fA-F-]{36})') report(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reportId', ParseUUIDPipe) _id: string,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.reports.getDashboard({ tenantId: a.tenantId, userId: a.membershipId, query: q });
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
  private async run(a: AuthenticatedPrincipal, q: ManagerDashboardQueryDto, report: string) {
    const data = await this.reports.getDashboard({
      tenantId: a.tenantId,
      userId: a.membershipId,
      query: q,
    });
    return { report, definitionVersion: 1, ...data };
  }
}
