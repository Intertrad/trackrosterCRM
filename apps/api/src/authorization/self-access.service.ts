import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { accountSettings, platformAccessGrants } from '../database/schema/index.js';
import { UserRepository } from '../users/user.repository.js';
import { AuthorizationService } from './authorization.service.js';
import type { SelfAccessContext, SelfAccessGrant } from './self-access.types.js';

export interface GetSelfAccessContextInput {
  identityId?: string;

  tenantId: string;

  userId: string;
}

@Injectable()
export class SelfAccessService {
  constructor(
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,

    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async getContext(input: GetSelfAccessContextInput): Promise<SelfAccessContext> {
    const user = await this.userRepository.findById(input.tenantId, input.userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    /* A membership that has never opened its settings has no row yet; the
     * column default is the same 'en' the account endpoints fall back to. */
    const [settings] = await this.database
      .select({ locale: accountSettings.locale })
      .from(accountSettings)
      .where(
        and(
          eq(accountSettings.tenantId, input.tenantId),
          eq(accountSettings.membershipId, input.userId),
        ),
      )
      .limit(1);

    // Platform authority is identity-level and never inferred from a tenant role.
    const platformGrants = input.identityId
      ? await this.database
          .select({ role: platformAccessGrants.role })
          .from(platformAccessGrants)
          .where(
            and(
              eq(platformAccessGrants.identityId, input.identityId),
              eq(platformAccessGrants.role, 'super_admin'),
              isNull(platformAccessGrants.revokedAt),
            ),
          )
          .limit(1)
      : [];

    const responseGrants: SelfAccessGrant[] = grants
      .map((grant) => ({
        role: grant.role,

        scopeType: grant.scopeType,

        organizationId: grant.organizationId,

        teamId: grant.teamId,
      }))
      .sort((left, right) => {
        const leftKey = this.buildSortKey(left);

        const rightKey = this.buildSortKey(right);

        return leftKey.localeCompare(rightKey);
      });

    return {
      ...(input.identityId
        ? { platformAdmin: platformGrants.some((grant) => grant.role === 'super_admin') }
        : {}),
      userId: input.userId,

      tenantId: input.tenantId,

      email: user.email,

      displayName: user.displayName,

      locale: settings?.locale ?? 'en',

      grants: responseGrants,
    };
  }

  private buildSortKey(grant: SelfAccessGrant): string {
    return [grant.scopeType, grant.role, grant.organizationId ?? '', grant.teamId ?? ''].join(':');
  }
}
