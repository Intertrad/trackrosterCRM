import { RouteModule } from '../routes/route.controller.js';
import { RouteService } from '../routes/route.service.js';
import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Injectable,
  Module,
  Query,
  UseGuards,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DatabaseModule } from '../database/database.module.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
import { ManagerDashboardQueryDto } from './manager-dashboard-query.dto.js';
import { ReportingModule } from './reporting.module.js';
import { ProspectorTodayModule } from '../prospector-today/prospector-today.module.js';
import { ProspectorTodayService } from '../prospector-today/prospector-today.service.js';
import { ProspectorTodayQueryDto } from '../prospector-today/prospector-today-query.dto.js';
@Injectable()
export class CanonicalDashboardService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reports: ManagerDashboardService,
    private readonly today: ProspectorTodayService,
    private readonly routes: RouteService,
  ) {}
  async todayView(a: AuthenticatedPrincipal, q: ProspectorTodayQueryDto) {
    const result = await this.today.getToday({
      tenantId: a.tenantId,
      userId: a.membershipId,
      teamId: q.teamId,
      timeZone: q.timeZone,
    });
    return {
      ...result,
      routeSummary: await this.routes.todaySummary(
        a,
        q.teamId,
        result.day.startsAt,
        result.day.endsAt,
      ),
    };
  }
  private async role(a: AuthenticatedPrincipal, roles: string[]) {
    const r = await this.db.execute(
      sql`SELECT 1 FROM user_access_grants g JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id JOIN identities i ON i.id=m.identity_id WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND m.status='active' AND i.status='active' AND ((g.role='client_admin' AND g.scope_type='tenant') OR (${roles.includes('director') ? sql`g.role='director'` : sql`false`} AND g.scope_type='organization'))`,
    );
    if (!r.rows.length) throw new ForbiddenException('Dashboard role required');
  }
  async management(a: AuthenticatedPrincipal, q: ManagerDashboardQueryDto, director = false) {
    if (director) await this.role(a, ['director']);
    const base = await this.reports.getDashboard({
      tenantId: a.tenantId,
      userId: a.membershipId,
      query: q,
    });
    if (director && base.scope.authority === 'manager')
      throw new ForbiddenException('Director dashboard requires organization authority');
    const org = q.organizationId ?? base.scope.organizationId;
    const team = q.teamId ?? base.scope.teamId;
    const filter = sql`ca.tenant_id=${a.tenantId} ${org ? sql`AND ca.organization_id=${org}` : sql``} ${team ? sql`AND ca.team_id=${team}` : sql``} ${q.userId ? sql`AND ca.assigned_user_id=${q.userId}` : sql``} ${q.campaignId ? sql`AND cp.campaign_id=${q.campaignId}` : sql``}`;
    const workload = await this.db.execute(
      sql`SELECT ca.organization_id AS "organizationId",ca.team_id AS "teamId",count(*)::int AS current,count(*) FILTER(WHERE ca.status='paused')::int AS paused,count(*) FILTER(WHERE ca.assigned_user_id IS NULL)::int AS "teamOwned" FROM campaign_prospect_assignments ca JOIN campaign_prospects cp ON cp.tenant_id=ca.tenant_id AND cp.id=ca.campaign_prospect_id WHERE ${filter} AND ca.ended_at IS NULL GROUP BY ca.organization_id,ca.team_id ORDER BY ca.organization_id,ca.team_id LIMIT 501`,
    );
    const territories = await this.db.execute(
      sql`SELECT ct.territory_id AS "territoryId",count(DISTINCT ca.id)::int AS "currentAssignments" FROM campaign_prospect_assignments ca JOIN campaign_prospects cp ON cp.tenant_id=ca.tenant_id AND cp.id=ca.campaign_prospect_id JOIN campaign_territories ct ON ct.tenant_id=cp.tenant_id AND ct.campaign_id=cp.campaign_id WHERE ${filter} AND ca.ended_at IS NULL GROUP BY ct.territory_id ORDER BY ct.territory_id LIMIT 501`,
    );
    const outcomes = await this.db.execute(
      sql`SELECT o.outcome_code AS code,count(*)::int AS count FROM action_outcomes o JOIN actions ac ON ac.tenant_id=o.tenant_id AND ac.id=o.action_id JOIN campaign_prospect_assignments ca ON ca.tenant_id=ac.tenant_id AND ca.id=ac.assignment_id JOIN campaign_prospects cp ON cp.tenant_id=ca.tenant_id AND cp.id=ca.campaign_prospect_id WHERE ${filter} AND o.recorded_at>=${base.range.from}::timestamptz AND o.recorded_at<${base.range.to}::timestamptz GROUP BY o.outcome_code ORDER BY o.outcome_code`,
    );
    const comparison = await this.db.execute(
      sql`SELECT ca.organization_id AS "organizationId",count(*)::int AS "currentAssignments",count(*) FILTER(WHERE ca.status='paused')::int AS "pausedAssignments" FROM campaign_prospect_assignments ca JOIN campaign_prospects cp ON cp.tenant_id=ca.tenant_id AND cp.id=ca.campaign_prospect_id WHERE ${filter} AND ca.ended_at IS NULL GROUP BY ca.organization_id ORDER BY ca.organization_id LIMIT 501`,
    );
    return {
      ...base,
      workload: { items: workload.rows.slice(0, 500), truncated: workload.rows.length > 500 },
      territories: {
        items: territories.rows.slice(0, 500),
        truncated: territories.rows.length > 500,
        basis: 'Campaign territory links; counts can overlap',
      },
      outcomes: outcomes.rows,
      ...(director
        ? {
            organizationComparison: {
              items: comparison.rows.slice(0, 500),
              truncated: comparison.rows.length > 500,
            },
            objectiveRisks: {
              available: false,
              reason: 'Campaign objective targets are not configured',
            },
          }
        : {}),
    };
  }
  async admin(a: AuthenticatedPrincipal) {
    await this.role(a, []);
    const result = await this.db.execute(sql`SELECT
   (SELECT count(*)::int FROM tenant_memberships WHERE tenant_id=${a.tenantId} AND status='active') AS "activeMembers",
   (SELECT count(*)::int FROM auth_sessions WHERE tenant_id=${a.tenantId} AND created_at>=now()-interval '30 days') AS "sessionsLast30Days",
   (SELECT count(*)::int FROM organizations WHERE tenant_id=${a.tenantId} AND status='active') AS "activeOrganizations",
   (SELECT count(*)::int FROM teams WHERE tenant_id=${a.tenantId} AND status='active') AS "activeTeams",
   (SELECT count(*)::int FROM campaigns WHERE tenant_id=${a.tenantId} AND status='active') AS "activeCampaigns",
   (SELECT count(*)::int FROM establishments WHERE tenant_id=${a.tenantId} AND (latitude IS NULL OR longitude IS NULL)) AS "prospectsMissingCoordinates",
   (SELECT count(*)::int FROM establishments WHERE tenant_id=${a.tenantId} AND phone IS NULL) AS "prospectsMissingPhone",
   (SELECT count(*)::int FROM export_jobs WHERE tenant_id=${a.tenantId} AND status='failed') AS "failedExports",
   (SELECT count(*)::int FROM import_jobs WHERE tenant_id=${a.tenantId} AND status='validated') AS "importsAwaitingCommit"`);
    return {
      generatedAt: new Date().toISOString(),
      scope: { tenantId: a.tenantId },
      metrics: result.rows[0],
      readiness: {
        productionCertified: false,
        checks: 'Operational counts only; deployment readiness requires separate validation',
      },
    };
  }
}
@Controller('dashboard')
@UseGuards(AuthGuard)
export class CanonicalDashboardController {
  constructor(private readonly service: CanonicalDashboardService) {}
  @Get('today') today(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ProspectorTodayQueryDto,
  ) {
    return this.service.todayView(a, q);
  }
  @Get('manager') manager(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.service.management(a, q);
  }
  @Get('director') director(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.service.management(a, q, true);
  }
  @Get('admin') admin(@CurrentAuth() a: AuthenticatedPrincipal) {
    return this.service.admin(a);
  }
}
@Module({
  imports: [RouteModule, AuthModule, DatabaseModule, ReportingModule, ProspectorTodayModule],
  controllers: [CanonicalDashboardController],
  providers: [CanonicalDashboardService],
})
export class CanonicalDashboardModule {}
