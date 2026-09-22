import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { and, eq, sql } from 'drizzle-orm';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { DEFAULT_SECURITY_POLICY } from '../auth/security-policy.service.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import {
  auditEvents,
  identities,
  tenantSecurityPolicies,
  tenants,
} from '../database/schema/index.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { ResourceETagInterceptor, assertResourceMatches } from '../http/resource-etag.js';
class UpdateSecurityPolicyDto {
  @IsOptional() @IsBoolean() requireMfa?: boolean;
  @IsOptional() @IsInt() @Min(12) @Max(128) passwordMinLength?: number;
  @IsOptional() @IsInt() @Min(1) @Max(168) sessionMaxHours?: number;
}
@Controller('settings/security')
@UseGuards(AuthGuard, ClientAdminGuard)
@UseInterceptors(ResourceETagInterceptor)
export class SecurityPolicyController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  @Get()
  async get(@CurrentAuth() auth: AuthenticatedPrincipal) {
    const [row] = await this.db
      .select()
      .from(tenantSecurityPolicies)
      .where(eq(tenantSecurityPolicies.tenantId, auth.tenantId));
    return row ?? { tenantId: auth.tenantId, ...DEFAULT_SECURITY_POLICY, updatedAt: null };
  }
  @Patch()
  @Idempotent('security_policy.update')
  async update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: UpdateSecurityPolicyDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .for('update');
      const [current] = await tx
        .select()
        .from(tenantSecurityPolicies)
        .where(eq(tenantSecurityPolicies.tenantId, auth.tenantId));
      assertResourceMatches(
        ifMatch,
        current ?? { tenantId: auth.tenantId, ...DEFAULT_SECURITY_POLICY, updatedAt: null },
      );
      if (input.requireMfa) {
        const [actor] = await tx
          .select({ enrolled: identities.mfaEnrolledAt })
          .from(identities)
          .where(and(eq(identities.id, auth.identityId), eq(identities.status, 'active')));
        if (!actor?.enrolled)
          throw new ConflictException('Enroll in MFA before requiring it for this workspace');
      }
      const values = {
        tenantId: auth.tenantId,
        ...(current ?? DEFAULT_SECURITY_POLICY),
        ...input,
        updatedAt: sql`clock_timestamp()`,
      };
      const [result] = await tx
        .insert(tenantSecurityPolicies)
        .values(values)
        .onConflictDoUpdate({
          target: tenantSecurityPolicies.tenantId,
          set: { ...input, updatedAt: sql`clock_timestamp()` },
        })
        .returning();
      await tx.insert(auditEvents).values({
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.membershipId,
        action: 'security.policy_updated',
        resourceType: 'tenant_security_policy',
        resourceId: auth.tenantId,
        metadata: { before: current ?? DEFAULT_SECURITY_POLICY, after: result },
      });
      return result;
    });
  }
}
