import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { UserRepository } from '../users/user.repository.js';
import { AuthorizationService } from './authorization.service.js';
import type { SelfAccessContext, SelfAccessGrant } from './self-access.types.js';

export interface GetSelfAccessContextInput {
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
  ) {}

  async getContext(input: GetSelfAccessContextInput): Promise<SelfAccessContext> {
    const user = await this.userRepository.findById(input.tenantId, input.userId);

    if (!user) {
      throw new UnauthorizedException('Authenticated user no longer exists');
    }

    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

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
      userId: input.userId,

      tenantId: input.tenantId,

      email: user.email,

      displayName: user.displayName,

      grants: responseGrants,
    };
  }

  private buildSortKey(grant: SelfAccessGrant): string {
    return [grant.scopeType, grant.role, grant.organizationId ?? '', grant.teamId ?? ''].join(':');
  }
}
