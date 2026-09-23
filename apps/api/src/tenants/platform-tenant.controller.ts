import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import { tenants } from '../database/schema/tenants.js';
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
