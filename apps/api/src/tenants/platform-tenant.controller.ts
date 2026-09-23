import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import { tenants } from '../database/schema/index.js';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard.js';
import { Inject } from '@nestjs/common';

@Controller('platform/tenants')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformTenantController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('status') status?: 'active' | 'suspended' | 'inactive') {
    const rows = await this.db
      .select()
      .from(tenants)
      .where(status ? eq(tenants.status, status) : undefined)
      .orderBy(desc(tenants.createdAt));
    return { items: rows };
  }

  @Get(':tenantId')
  async detail(@Param('tenantId') tenantId: string) {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    return tenant ?? null;
  }

  @Get(':tenantId/usage')
  async usage(@Param('tenantId') tenantId: string) {
    const [members, prospects, campaigns, activities] = await Promise.all([
      this.db.execute(
        sql`SELECT count(*)::int AS count FROM tenant_memberships WHERE tenant_id=${tenantId}`,
      ),
      this.db.execute(
        sql`SELECT count(*)::int AS count FROM prospects WHERE tenant_id=${tenantId}`,
      ),
      this.db.execute(
        sql`SELECT count(*)::int AS count FROM campaigns WHERE tenant_id=${tenantId}`,
      ),
      this.db.execute(
        sql`SELECT count(*)::int AS count FROM activities WHERE tenant_id=${tenantId}`,
      ),
    ]);
    return {
      tenantId,
      memberships: members.rows[0]?.count ?? 0,
      prospects: prospects.rows[0]?.count ?? 0,
      campaigns: campaigns.rows[0]?.count ?? 0,
      activities: activities.rows[0]?.count ?? 0,
    };
  }

  @Get(':tenantId/config')
  async config(@Param('tenantId') tenantId: string) {
    const [tenant] = await this.db
      .select({ platformConfig: tenants.platformConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return tenant?.platformConfig ?? {};
  }

  @Patch(':tenantId/config')
  async updateConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: Record<string, unknown>,
    @CurrentAuth() auth: AuthenticatedPrincipal,
  ) {
    const [tenant] = await this.db
      .update(tenants)
      .set({ platformConfig: body, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    if (tenant)
      await this.audit.record({
        tenantId,
        actorType: 'user',
        actorUserId: auth.userId,
        action: 'platform.tenant_configured',
        resourceType: 'tenant',
        resourceId: tenantId,
        metadata: { keys: Object.keys(body) },
      });
    return tenant?.platformConfig ?? {};
  }

  @Patch(':tenantId/status')
  async setStatus(
    @Param('tenantId') tenantId: string,
    @Body() body: { status: 'active' | 'suspended' | 'inactive' },
    @CurrentAuth() auth: AuthenticatedPrincipal,
  ) {
    const [tenant] = await this.db
      .update(tenants)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();
    if (tenant)
      await this.audit.record({
        tenantId,
        actorType: 'user',
        actorUserId: auth.userId,
        action: 'platform.tenant_status_changed',
        resourceType: 'tenant',
        resourceId: tenantId,
        metadata: { status: body.status },
      });
    return tenant ?? null;
  }
}
