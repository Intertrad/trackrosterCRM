import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
export const DEFAULT_SECURITY_POLICY = {
  requireMfa: false,
  passwordMinLength: 12,
  sessionMaxHours: 168,
};
@Injectable()
export class SecurityPolicyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  /*
   * Resolved through a definer function (migration 0075) rather than a direct
   * query. The aggregate spans every workspace the identity belongs to, so
   * there is no single tenant context it can run under — and the callers are
   * sign-in, recovery and invitation acceptance, which have none. Under RLS a
   * direct query here does not fail; it aggregates over zero visible rows and
   * quietly returns the permissive default, which would drop a workspace's MFA
   * requirement and password floor without any error.
   */
  async forIdentity(
    identityId: string,
    executor: DatabaseExecutor = this.db,
    acceptingTenantId?: string,
  ) {
    const result = await executor.execute<{
      require_mfa: boolean;
      password_min_length: number;
    }>(
      sql`select require_mfa, password_min_length
          from trackroster_identity_security_policy(${identityId}, ${acceptingTenantId ?? null})`,
    );

    const row = result.rows[0];

    if (!row) return DEFAULT_SECURITY_POLICY;

    return {
      requireMfa: row.require_mfa,
      passwordMinLength: Number(row.password_min_length),
    };
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
