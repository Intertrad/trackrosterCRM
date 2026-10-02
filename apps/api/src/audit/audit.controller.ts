import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, gt, sql, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { auditEvents, evidenceExports } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { EvidenceExportScopeDto } from './audit.dto.js';
type Auth = AuthenticatedPrincipal;
@Controller('audit')
@UseGuards(AuthGuard)
export class AuditController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  /**
   * Return the audit visibility predicate for this membership.
   *
   * Observer grants are deliberately allowed at tenant, organization and
   * team scope. The previous check only accepted tenant-scoped observers,
   * which made the seeded scoped auditor fail every audit request with 400.
   * Scoped grants still remain scoped in the query: records are resolved
   * through their owning organization/team before they are returned.
   */
  private async allowed(a: Auth): Promise<SQL> {
    const result = await this.db.execute<{
      role: string;
      scope_type: string;
      organization_id: string | null;
      team_id: string | null;
    }>(sql`
      SELECT role, scope_type, organization_id, team_id
      FROM user_access_grants
      WHERE tenant_id=${a.tenantId}
        AND user_id=${a.membershipId}
        AND role IN ('client_admin', 'director', 'observer')
    `);
    const grants = result.rows;
    if (!grants.length) throw new BadRequestException('Audit access required');

    if (
      grants.some(
        (grant) =>
          (grant.role === 'client_admin' || grant.role === 'observer') &&
          grant.scope_type === 'tenant',
      )
    ) {
      return sql`TRUE`;
    }

    const scopes = grants.filter(
      (grant) =>
        (grant.role === 'director' || grant.role === 'observer') &&
        (grant.scope_type === 'organization' || grant.scope_type === 'team') &&
        (grant.organization_id || grant.team_id),
    );
    if (!scopes.length) throw new BadRequestException('Audit access required');

    const predicates = scopes.map((grant) => {
      const organizationId = grant.organization_id;
      const teamId = grant.team_id;
      const teamScope = grant.scope_type === 'team';
      return sql`(
        audit_events.actor_user_id=${a.membershipId}
        OR (
          audit_events.resource_type='organization'
          AND audit_events.resource_id=${organizationId ?? ''}
        )
        OR (
          audit_events.resource_type='team'
          AND EXISTS (
            SELECT 1 FROM teams t
            WHERE t.tenant_id=${a.tenantId}
              AND t.id::text=audit_events.resource_id
              AND t.organization_id=${organizationId ?? ''}
              ${teamScope ? sql`AND t.id=${teamId}` : sql``}
          )
        )
        OR (
          audit_events.resource_type='campaign'
          AND EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.tenant_id=${a.tenantId}
              AND c.id::text=audit_events.resource_id
              AND c.organization_id=${organizationId ?? ''}
          )
        )
        OR (
          audit_events.resource_type='campaign_organization'
          AND EXISTS (
            SELECT 1 FROM campaign_organizations co
            WHERE co.tenant_id=${a.tenantId}
              AND co.id::text=audit_events.resource_id
              AND co.organization_id=${organizationId ?? ''}
          )
        )
        OR (
          audit_events.resource_type='assignment'
          AND EXISTS (
            SELECT 1 FROM campaign_prospect_assignments ca
            WHERE ca.tenant_id=${a.tenantId}
              AND ca.id::text=audit_events.resource_id
              AND ca.organization_id=${organizationId ?? ''}
              ${teamScope ? sql`AND ca.team_id=${teamId}` : sql``}
          )
        )
        OR (
          audit_events.resource_type='campaign_prospect'
          AND EXISTS (
            SELECT 1
            FROM campaign_prospects cp
            JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id
            WHERE cp.tenant_id=${a.tenantId}
              AND cp.id::text=audit_events.resource_id
              AND c.organization_id=${organizationId ?? ''}
              ${
                teamScope
                  ? sql`AND EXISTS (
                      SELECT 1 FROM campaign_prospect_assignments ca
                      WHERE ca.tenant_id=cp.tenant_id
                        AND ca.campaign_prospect_id=cp.id
                        AND ca.team_id=${teamId}
                    )`
                  : sql``
              }
          )
        )
        OR (
          audit_events.resource_type='follow_up'
          AND EXISTS (
            SELECT 1
            FROM prospect_follow_ups f
            JOIN campaign_prospect_assignments ca
              ON ca.tenant_id=f.tenant_id AND ca.id=f.assignment_id
            WHERE f.tenant_id=${a.tenantId}
              AND f.id::text=audit_events.resource_id
              AND ca.organization_id=${organizationId ?? ''}
              ${teamScope ? sql`AND ca.team_id=${teamId}` : sql``}
          )
        )
        OR (
          audit_events.resource_type='action'
          AND EXISTS (
            SELECT 1
            FROM actions ac
            JOIN campaign_prospect_assignments ca
              ON ca.tenant_id=ac.tenant_id AND ca.id=ac.assignment_id
            WHERE ac.tenant_id=${a.tenantId}
              AND ac.id::text=audit_events.resource_id
              AND ca.organization_id=${organizationId ?? ''}
              ${teamScope ? sql`AND ca.team_id=${teamId}` : sql``}
          )
        )
      )`;
    });
    return sql`(${sql.join(predicates, sql` OR `)})`;
  }
  @Get('events') async list(
    @CurrentAuth() a: Auth,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    const visibility = await this.allowed(a);
    const n = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          visibility,
          action ? eq(auditEvents.action, action) : undefined,
          resourceType ? eq(auditEvents.resourceType, resourceType) : undefined,
          cursor ? gt(auditEvents.id, cursor) : undefined,
        ),
      )
      .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
      .limit(n + 1);
    return { items: rows.slice(0, n), nextCursor: rows.length > n ? rows[n - 1]!.id : null };
  }
  @Get('events/:eventId') async detail(
    @CurrentAuth() a: Auth,
    @Param('eventId', ParseUUIDPipe) id: string,
  ) {
    const visibility = await this.allowed(a);
    const [r] = await this.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, a.tenantId), eq(auditEvents.id, id), visibility));
    if (!r) throw new BadRequestException('Audit event not found');
    return r;
  }
  @Get('overview') async overview(@CurrentAuth() a: Auth) {
    const visibility = await this.allowed(a);
    const [r] = await this.db
      .select({
        events: sql<number>`count(*)::int`,
        actors: sql<number>`count(distinct actor_user_id)::int`,
        latest: sql<Date>`max(occurred_at)`,
      })
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, a.tenantId), visibility));
    return { tenantId: a.tenantId, ...r };
  }
  @Get('users/:membershipId/access') async access(
    @CurrentAuth() a: Auth,
    @Param('membershipId', ParseUUIDPipe) id: string,
  ) {
    const visibility = await this.allowed(a);
    return this.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, a.tenantId), eq(auditEvents.actorUserId, id), visibility))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(100);
  }
  @Get('data-changes') data(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'prospect');
  }
  @Get('security-events') security(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'security');
  }
  @Get('security-events/:eventId') securityDetail(
    @CurrentAuth() a: Auth,
    @Param('eventId') id: string,
  ) {
    return this.resource(a, id, 'security');
  }
  @Get('assignments') assignments(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'assignment');
  }
  @Get('assignments/:assignmentId') assignment(
    @CurrentAuth() a: Auth,
    @Param('assignmentId') id: string,
  ) {
    return this.resource(a, id, 'assignment');
  }
  @Get('overrides') overrides(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'override_request');
  }
  @Get('overrides/:overrideId') override(@CurrentAuth() a: Auth, @Param('overrideId') id: string) {
    return this.resource(a, id, 'override_request');
  }
  @Get('collisions') collisions(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'collision');
  }
  @Get('collisions/:collisionId') collision(
    @CurrentAuth() a: Auth,
    @Param('collisionId') id: string,
  ) {
    return this.resource(a, id, 'collision');
  }
  @Get('exports') exports(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'export');
  }
  @Get('exports/:exportId') export(@CurrentAuth() a: Auth, @Param('exportId') id: string) {
    return this.resource(a, id, 'export');
  }
  @Get('retention') retention(@CurrentAuth() a: Auth) {
    return this.overview(a);
  }
  @Post('evidence-exports') @HttpCode(202) async evidence(
    @CurrentAuth() a: Auth,
    @Body() scope: EvidenceExportScopeDto,
  ) {
    await this.allowed(a);
    const [r] = await this.db
      .insert(evidenceExports)
      .values({
        tenantId: a.tenantId,
        requestedBy: a.membershipId,
        scope,
        objectKey: `${a.tenantId}/evidence/${Date.now()}.json`,
        expiresAt: new Date(Date.now() + 86400000),
      })
      .returning();
    return r;
  }
  @Get('evidence-exports/:exportId') async evidenceDetail(
    @CurrentAuth() a: Auth,
    @Param('exportId', ParseUUIDPipe) id: string,
  ) {
    await this.allowed(a);
    const [r] = await this.db
      .select()
      .from(evidenceExports)
      .where(and(eq(evidenceExports.tenantId, a.tenantId), eq(evidenceExports.id, id)));
    if (!r) throw new BadRequestException('Evidence export not found');
    return r;
  }
  private async resource(a: Auth, id: string, type: string) {
    const visibility = await this.allowed(a);
    const events = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          eq(auditEvents.resourceType, type),
          eq(auditEvents.resourceId, id),
          visibility,
        ),
      )
      .orderBy(desc(auditEvents.occurredAt));
    return { resourceType: type, resourceId: id, events };
  }
}
