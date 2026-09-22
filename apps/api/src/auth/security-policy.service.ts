import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { tenantSecurityPolicies, tenantMemberships, tenants } from '../database/schema/index.js';
export const DEFAULT_SECURITY_POLICY = {
  requireMfa: false,
  passwordMinLength: 12,
  sessionMaxHours: 168,
};
@Injectable()
export class SecurityPolicyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async forIdentity(
    identityId: string,
    executor: DatabaseExecutor = this.db,
    acceptingTenantId?: string,
  ) {
    const [row] = await executor
      .select({
        requireMfa: sql<boolean>`coalesce(bool_or(${tenantSecurityPolicies.requireMfa}), false)`,
        passwordMinLength: sql<number>`coalesce(max(${tenantSecurityPolicies.passwordMinLength}), 12)`,
      })
      .from(tenantMemberships)
      .innerJoin(
        tenants,
        and(eq(tenants.id, tenantMemberships.tenantId), eq(tenants.status, 'active')),
      )
      .leftJoin(
        tenantSecurityPolicies,
        eq(tenantSecurityPolicies.tenantId, tenantMemberships.tenantId),
      )
      .where(
        and(
          eq(tenantMemberships.identityId, identityId),
          acceptingTenantId
            ? or(
                eq(tenantMemberships.status, 'active'),
                and(
                  eq(tenantMemberships.status, 'invited'),
                  eq(tenantMemberships.tenantId, acceptingTenantId),
                ),
              )
            : eq(tenantMemberships.status, 'active'),
        ),
      );
    return row ?? DEFAULT_SECURITY_POLICY;
  }
  async validatePassword(
    identityId: string,
    password: string,
    executor: DatabaseExecutor = this.db,
    acceptingTenantId?: string,
  ) {
    const policy = await this.forIdentity(identityId, executor, acceptingTenantId);
    if (password.length < policy.passwordMinLength || password.length > 128)
      throw new BadRequestException(
        `Password must contain between ${policy.passwordMinLength} and 128 characters`,
      );
  }
}
