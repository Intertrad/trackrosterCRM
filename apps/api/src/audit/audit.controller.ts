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
import { and, desc, eq, gt, sql } from 'drizzle-orm';
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
  private async allowed(a: Auth) {
    const r = await this.db.execute(
      sql`SELECT 1 FROM user_access_grants WHERE tenant_id=${a.tenantId} AND user_id=${a.membershipId} AND ((scope_type='tenant' AND role IN ('client_admin','observer')) OR role='director') LIMIT 1`,
    );
    if (!r.rows.length) throw new BadRequestException('Audit access required');
  }
  @Get('events') async list(
    @CurrentAuth() a: Auth,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    await this.allowed(a);
    const n = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
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
    await this.allowed(a);
    const [r] = await this.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, a.tenantId), eq(auditEvents.id, id)));
    if (!r) throw new BadRequestException('Audit event not found');
    return r;
  }
  @Get('overview') async overview(@CurrentAuth() a: Auth) {
    await this.allowed(a);
    const [r] = await this.db
      .select({
        events: sql<number>`count(*)::int`,
        actors: sql<number>`count(distinct actor_user_id)::int`,
        latest: sql<Date>`max(occurred_at)`,
      })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, a.tenantId));
    return { tenantId: a.tenantId, ...r };
  }
  @Get('users/:membershipId/access') async access(
    @CurrentAuth() a: Auth,
    @Param('membershipId', ParseUUIDPipe) id: string,
  ) {
    await this.allowed(a);
    return this.db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, a.tenantId), eq(auditEvents.actorUserId, id)))
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
    await this.allowed(a);
    const events = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, a.tenantId),
          eq(auditEvents.resourceType, type),
          eq(auditEvents.resourceId, id),
        ),
      )
      .orderBy(desc(auditEvents.occurredAt));
    return { resourceType: type, resourceId: id, events };
  }
}
