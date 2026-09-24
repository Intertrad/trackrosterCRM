import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard.js';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import { identities, platformAccessGrants } from '../database/schema/index.js';
import { AuditService } from '../audit/audit.service.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { PlatformGrantDto, PlatformGrantRevokeDto } from './platform-user.dto.js';

@Controller('platform/users')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformUserController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}
  @Get()
  async list() {
    return {
      items: await this.db
        .select({
          identityId: identities.id,
          email: identities.email,
          status: identities.status,
          role: platformAccessGrants.role,
          grantedAt: platformAccessGrants.grantedAt,
        })
        .from(platformAccessGrants)
        .innerJoin(identities, eq(identities.id, platformAccessGrants.identityId))
        .where(isNull(platformAccessGrants.revokedAt))
        .orderBy(desc(platformAccessGrants.grantedAt)),
    };
  }

  @Post(':identityId/grants')
  async grant(
    @Param('identityId', new ParseUUIDPipe()) identityId: string,
    @Body() body: PlatformGrantDto,
    @CurrentAuth() auth: AuthenticatedPrincipal,
  ) {
    const [grant] = await this.db
      .insert(platformAccessGrants)
      .values({
        identityId,
        role: body.role,
        grantSource: 'platform_admin',
        grantedByIdentityId: auth.identityId,
        grantReason: body.reason,
        externalReference: `manual:${Date.now()}`,
      })
      .returning();
    await this.audit.record({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.userId,
      action: 'platform.user_granted',
      resourceType: 'identity',
      resourceId: identityId,
      metadata: { role: body.role },
    });
    return grant;
  }

  @Post(':identityId/grants/:grantId/revoke')
  async revoke(
    @Param('identityId', new ParseUUIDPipe()) identityId: string,
    @Param('grantId', new ParseUUIDPipe()) grantId: string,
    @Body() body: PlatformGrantRevokeDto,
    @CurrentAuth() auth: AuthenticatedPrincipal,
  ) {
    const [grant] = await this.db
      .update(platformAccessGrants)
      .set({
        revokedAt: new Date(),
        revokedByIdentityId: auth.identityId,
        revocationReason: body.reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformAccessGrants.id, grantId),
          eq(platformAccessGrants.identityId, identityId),
          isNull(platformAccessGrants.revokedAt),
        ),
      )
      .returning();
    if (grant)
      await this.audit.record({
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.userId,
        action: 'platform.user_revoked',
        resourceType: 'identity',
        resourceId: identityId,
        metadata: { grantId },
      });
    return grant ?? null;
  }
}
