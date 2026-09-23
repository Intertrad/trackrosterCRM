import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { auditEvents } from '../database/schema/index.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
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
  @Get('assignments') assignments(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'assignment');
  }
  @Get('overrides') overrides(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'override_request');
  }
  @Get('collisions') collisions(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'collision');
  }
  @Get('exports') exports(@CurrentAuth() a: Auth, @Query() q: Record<string, string>) {
    return this.list(a, Number(q.limit), q.cursor, q.action, 'export');
  }
  @Get('retention') retention(@CurrentAuth() a: Auth) {
    return this.overview(a);
  }
}
