import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ObjectiveModule } from '../objectives/objective.controller.js';
import { ObjectiveService } from '../objectives/objective.service.js';
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
export class IndicatorQueryDto {
  @IsOptional() @IsString() @MaxLength(40) role?: string;
  @IsOptional() @IsUUID() cursor?: string;
}
@Injectable()
export class CanonicalDashboardService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reports: ManagerDashboardService,
    private readonly today: ProspectorTodayService,
    private readonly routes: RouteService,
    private readonly objectives: ObjectiveService,
  ) {}
  async activityDetails(a: AuthenticatedPrincipal, q: ManagerDashboardQueryDto) {
    const base = await this.reports.getDashboard({
      tenantId: a.tenantId,
      userId: a.membershipId,
      query: q,
    });
    const org = base.filters.organizationId ?? base.scope.organizationId;
    const team = base.filters.teamId ?? base.scope.teamId;
    const result = await this.db.execute(sql`
      SELECT (coalesce(ac.completed_at, ac.cancelled_at, ac.due_at, ac.created_at) AT TIME ZONE 'Europe/Paris')::date::text AS date,
        ac.type AS channel,
        CASE WHEN ac.status='completed' THEN 'completed' WHEN ac.status='cancelled' THEN 'cancelled'
          WHEN ac.due_at < ${base.generatedAt}::timestamptz THEN 'overdue' ELSE 'pending' END AS status,
        ao.outcome_code AS outcome, count(*)::int AS count
      FROM actions ac
      JOIN campaign_prospect_assignments ca ON ca.tenant_id=ac.tenant_id AND ca.id=ac.assignment_id
      LEFT JOIN action_outcomes ao ON ao.tenant_id=ac.tenant_id AND ao.action_id=ac.id
      WHERE ac.tenant_id=${a.tenantId}
        ${org ? sql`AND ca.organization_id=${org}` : sql``}
        ${team ? sql`AND ca.team_id=${team}` : sql``}
        ${base.filters.userId ? sql`AND ac.assignee_membership_id=${base.filters.userId}` : sql``}
        ${base.filters.campaignId ? sql`AND ac.campaign_id=${base.filters.campaignId}` : sql``}
        AND coalesce(ac.completed_at, ac.cancelled_at, ac.due_at, ac.created_at)>=${base.range.from}::timestamptz
        AND coalesce(ac.completed_at, ac.cancelled_at, ac.due_at, ac.created_at)<${base.range.to}::timestamptz
      GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`);
    return {
      generatedAt: base.generatedAt,
      range: base.range,
      scope: base.scope,
      timeZone: 'Europe/Paris',
      basis:
        'Completion date for completed actions, cancellation date for cancelled actions, otherwise due date or creation date. Overdue is measured at generatedAt.',
      items: result.rows,
    };
  }
  async peopleDetails(a: AuthenticatedPrincipal, q: IndicatorQueryDto) {
    await this.role(a, []);
    const people = sql`WITH people AS (
      SELECT m.id, m.display_name AS "displayName", i.email, m.status,
        EXISTS(SELECT 1 FROM membership_invitations inv WHERE inv.tenant_id=m.tenant_id AND inv.membership_id=m.id AND inv.consumed_at IS NULL AND inv.expires_at>now() AND m.status='invited') AS "pendingInvitation",
        ARRAY(SELECT DISTINCT role FROM (
          SELECT g.role::text AS role FROM user_access_grants g WHERE g.tenant_id=m.tenant_id AND g.user_id=m.id
          UNION SELECT r.role::text FROM membership_resource_scopes r WHERE r.tenant_id=m.tenant_id AND r.user_id=m.id
        ) roles) AS roles
      FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id WHERE m.tenant_id=${a.tenantId}
    )`;
    const totals = await this.db.execute(
      sql`${people} SELECT count(*)::int AS total, count(*) FILTER(WHERE status='active')::int AS active, count(*) FILTER(WHERE "pendingInvitation")::int AS invitations FROM people`,
    );
    const roles = await this.db.execute(
      sql`${people} SELECT role, count(*)::int AS count, count(*) FILTER(WHERE "pendingInvitation")::int AS invitations FROM people CROSS JOIN LATERAL unnest(CASE WHEN cardinality(roles)=0 THEN ARRAY['unassigned'] ELSE roles END) role GROUP BY role ORDER BY role`,
    );
    const rows = await this.db.execute(sql`${people} SELECT * FROM people WHERE true
      ${q.role === 'unassigned' ? sql`AND cardinality(roles)=0` : q.role ? sql`AND ${q.role}=ANY(roles)` : sql``}
      ${q.cursor ? sql`AND id>${q.cursor}::uuid` : sql``} ORDER BY id LIMIT 101`);
    const items = rows.rows.slice(0, 100);
    return {
      ...totals.rows[0],
      roles: roles.rows,
      items,
      nextCursor: rows.rows.length > 100 ? items.at(-1)?.id : null,
    };
  }
  async duplicateDetails(a: AuthenticatedPrincipal, q: IndicatorQueryDto) {
    await this.role(a, []);
    const result = await this.db
      .execute(sql`SELECT d.id, d.matching_keys AS "matchingKeys", d.created_at AS "createdAt",
      l.id AS "leftId", l.name AS "leftName", r.id AS "rightId", r.name AS "rightName"
      FROM prospect_duplicates d JOIN establishments l ON l.tenant_id=d.tenant_id AND l.id=d.left_prospect_id
      JOIN establishments r ON r.tenant_id=d.tenant_id AND r.id=d.right_prospect_id
      WHERE d.tenant_id=${a.tenantId} AND d.resolution='pending' ${q.cursor ? sql`AND d.id>${q.cursor}::uuid` : sql``}
      ORDER BY d.id LIMIT 101`);
    const items = result.rows.slice(0, 100);
    return { items, nextCursor: result.rows.length > 100 ? items.at(-1)?.id : null };
  }
  async unownedDetails(a: AuthenticatedPrincipal, q: IndicatorQueryDto) {
    await this.role(a, []);
    const rows = await this.db.execute(sql`SELECT e.id, e.name, e.city FROM establishments e
      WHERE e.tenant_id=${a.tenantId} AND e.status='active' ${q.cursor ? sql`AND e.id>${q.cursor}::uuid` : sql``}
      AND NOT EXISTS (SELECT 1 FROM campaign_prospects cp
        JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id AND c.status='active'
        JOIN campaign_prospect_assignments ca ON ca.tenant_id=cp.tenant_id AND ca.campaign_prospect_id=cp.id AND ca.ended_at IS NULL
        WHERE cp.tenant_id=e.tenant_id AND cp.establishment_id=e.id AND cp.status='active') ORDER BY e.id LIMIT 101`);
    const items = rows.rows.slice(0, 100);
    return { items, nextCursor: rows.rows.length > 100 ? items.at(-1)?.id : null };
  }
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
            objectiveRisks: await this.objectives.atRisk(
              a,
              {
                organizationId: org ?? undefined,
                teamId: team ?? undefined,
                campaignId: q.campaignId,
                ownerId: q.userId,
                limit: 100,
              },
              base.range,
            ),
          }
        : {}),
    };
  }
  async admin(a: AuthenticatedPrincipal) {
    await this.role(a, []);
    const result = await this.db.execute(sql`SELECT
   (SELECT count(*)::int FROM establishments WHERE tenant_id=${a.tenantId} AND status='active') AS "totalEstablishments",
   (SELECT count(DISTINCT establishment_id)::int FROM prospect_activities WHERE tenant_id=${a.tenantId}) AS "contactedEstablishments",
   (SELECT count(*)::int FROM tenant_memberships WHERE tenant_id=${a.tenantId} AND status='active') AS "activeMembers",
   (SELECT count(*)::int FROM tenant_memberships WHERE tenant_id=${a.tenantId}) AS "totalMembers",
   (SELECT count(*)::int FROM auth_sessions WHERE tenant_id=${a.tenantId} AND created_at>=now()-interval '30 days') AS "sessionsLast30Days",
   (SELECT count(*)::int FROM organizations WHERE tenant_id=${a.tenantId} AND status='active') AS "activeOrganizations",
   (SELECT count(*)::int FROM teams WHERE tenant_id=${a.tenantId} AND status='active') AS "activeTeams",
   (SELECT count(*)::int FROM campaigns WHERE tenant_id=${a.tenantId} AND status='active') AS "activeCampaigns",
   (SELECT count(*)::int FROM establishments e WHERE e.tenant_id=${a.tenantId} AND e.status='active' AND NOT EXISTS (
      SELECT 1 FROM campaign_prospects cp
      JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id AND c.status='active'
      JOIN campaign_prospect_assignments cpa ON cpa.tenant_id=cp.tenant_id AND cpa.campaign_prospect_id=cp.id AND cpa.ended_at IS NULL
      WHERE cp.tenant_id=e.tenant_id AND cp.establishment_id=e.id AND cp.status='active'
   )) AS "establishmentsWithoutOwner",
   (SELECT count(*)::int FROM establishments WHERE tenant_id=${a.tenantId} AND (latitude IS NULL OR longitude IS NULL)) AS "prospectsMissingCoordinates",
   (SELECT count(*)::int FROM establishments WHERE tenant_id=${a.tenantId} AND phone IS NULL) AS "prospectsMissingPhone",
   (SELECT count(*)::int FROM prospect_duplicates WHERE tenant_id=${a.tenantId} AND resolution='pending') AS "pendingDuplicateReviews",
   (SELECT count(*)::int FROM membership_invitations i JOIN tenant_memberships m ON m.tenant_id=i.tenant_id AND m.id=i.membership_id WHERE i.tenant_id=${a.tenantId} AND m.status='invited' AND i.consumed_at IS NULL AND i.expires_at>now()) AS "pendingInvitations",
   (SELECT count(*)::int FROM organization_coordination_policies WHERE tenant_id=${a.tenantId}) AS "coordinationRulesSet",
   (SELECT (count(*) * (count(*) - 1) / 2)::int FROM organizations WHERE tenant_id=${a.tenantId} AND status='active') AS "coordinationPairs",
   (SELECT count(*)::int FROM organizations WHERE tenant_id=${a.tenantId} AND status='active' AND (phone IS NULL OR email IS NULL OR website IS NULL OR address IS NULL OR argumentaire IS NULL OR cardinality(prospected_sectors)=0)) AS "incompleteOrganizations",
   (SELECT count(*)::int FROM script_templates WHERE tenant_id=${a.tenantId} AND enabled=true) AS "activeScriptTemplates",
   (SELECT count(*)::int FROM identities i JOIN tenant_memberships m ON m.tenant_id=${a.tenantId} AND m.identity_id=i.id WHERE m.status='active' AND i.mfa_enrolled_at IS NOT NULL) AS "mfaEnrolledMembers",
   coalesce((SELECT require_mfa FROM tenant_security_policies WHERE tenant_id=${a.tenantId}), false) AS "mfaRequired",
   coalesce((SELECT password_min_length FROM tenant_security_policies WHERE tenant_id=${a.tenantId}), 12)::int AS "passwordMinLength",
   coalesce((SELECT session_max_hours FROM tenant_security_policies WHERE tenant_id=${a.tenantId}), 168)::int AS "sessionMaxHours",
   coalesce((SELECT sso IS NOT NULL FROM tenant_security_policies WHERE tenant_id=${a.tenantId}), false) AS "ssoConfigured",
   (SELECT count(*)::int FROM export_jobs WHERE tenant_id=${a.tenantId} AND status='failed') AS "failedExports",
   (SELECT count(*)::int FROM import_jobs WHERE tenant_id=${a.tenantId} AND status='validated') AS "importsAwaitingCommit"`);
    const organizations = await this.db.execute(sql`
      SELECT o.id, o.name, count(DISTINCT cp.establishment_id)::int AS establishments
      FROM organizations o
      LEFT JOIN campaigns c ON c.tenant_id=o.tenant_id AND c.organization_id=o.id AND c.status='active'
      LEFT JOIN campaign_prospects cp ON cp.tenant_id=c.tenant_id AND cp.campaign_id=c.id AND cp.status='active'
      WHERE o.tenant_id=${a.tenantId} AND o.status='active'
      GROUP BY o.id, o.name
      ORDER BY o.name`);
    const activitySummary = await this.db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM actions WHERE tenant_id=${a.tenantId}) AS "totalActions",
          (SELECT count(*)::int FROM actions WHERE tenant_id=${a.tenantId} AND created_at>=now()-interval '30 days') AS "periodActions",
          (SELECT count(*)::int FROM actions WHERE tenant_id=${a.tenantId} AND created_at>=date_trunc('day', now())) AS "actionsToday"`);
    const outcomes = await this.db.execute(sql`
        SELECT o.outcome_code AS code, count(*)::int AS count
        FROM action_outcomes o
        JOIN actions ac ON ac.tenant_id=o.tenant_id AND ac.id=o.action_id
        WHERE o.tenant_id=${a.tenantId} AND o.recorded_at>=now()-interval '30 days'
        GROUP BY o.outcome_code ORDER BY count DESC, o.outcome_code`);
    const channels = await this.db.execute(sql`
        SELECT type AS channel, count(*)::int AS count
        FROM actions
        WHERE tenant_id=${a.tenantId} AND created_at>=now()-interval '30 days'
        GROUP BY type ORDER BY count DESC, type`);
    const liveSummary = await this.db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM reservation_records WHERE tenant_id=${a.tenantId} AND status='active' AND expires_at>now()) AS "activeLocks",
          (SELECT count(*)::int FROM collision_events WHERE tenant_id=${a.tenantId} AND decision='block' AND created_at>=now()-interval '1 hour') AS "blockedLastHour",
          (SELECT count(*)::int FROM override_requests WHERE tenant_id=${a.tenantId} AND status='pending') AS "approvalsWaiting",
          (SELECT count(*)::int FROM actions WHERE tenant_id=${a.tenantId} AND created_at>=date_trunc('day', now())) AS "actionsToday",
          (SELECT count(DISTINCT membership_id)::int FROM auth_sessions WHERE tenant_id=${a.tenantId} AND revoked_at IS NULL AND expires_at>now() AND updated_at>=now()-interval '15 minutes') AS "usersOnline"`);
    const activity = await this.db.execute(sql`
      WITH days AS (SELECT generate_series((now() AT TIME ZONE 'Europe/Paris')::date - 13, (now() AT TIME ZONE 'Europe/Paris')::date, interval '1 day')::date AS day),
      counts AS (SELECT (occurred_at AT TIME ZONE 'Europe/Paris')::date AS day, count(*)::int AS total FROM prospect_activities WHERE tenant_id=${a.tenantId} AND occurred_at >= ((now() AT TIME ZONE 'Europe/Paris')::date - 13) AT TIME ZONE 'Europe/Paris' GROUP BY 1)
      SELECT days.day::text AS date, coalesce(counts.total,0)::int AS total FROM days LEFT JOIN counts USING(day) ORDER BY days.day`);
    return {
      generatedAt: new Date().toISOString(),
      scope: { tenantId: a.tenantId },
      activityByDay: activity.rows,
      activityTimeZone: 'Europe/Paris',
      metrics: result.rows[0],
      organizations: organizations.rows,
      activitySummary: {
        ...activitySummary.rows[0],
        outcomes: outcomes.rows,
        channels: channels.rows,
      },
      liveSummary: liveSummary.rows[0],
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
  @Get('activity') activity(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: ManagerDashboardQueryDto,
  ) {
    return this.service.activityDetails(a, q);
  }
  @Get('admin/people') people(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: IndicatorQueryDto,
  ) {
    return this.service.peopleDetails(a, q);
  }
  @Get('admin/duplicates') duplicates(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: IndicatorQueryDto,
  ) {
    return this.service.duplicateDetails(a, q);
  }
  @Get('admin/unowned') unowned(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: IndicatorQueryDto,
  ) {
    return this.service.unownedDetails(a, q);
  }
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
  imports: [
    ObjectiveModule,
    RouteModule,
    AuthModule,
    DatabaseModule,
    ReportingModule,
    ProspectorTodayModule,
  ],
  controllers: [CanonicalDashboardController],
  providers: [CanonicalDashboardService],
})
export class CanonicalDashboardModule {}
