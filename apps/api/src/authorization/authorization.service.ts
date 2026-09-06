import { Inject, Injectable } from '@nestjs/common';

import { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(UserAccessGrantRepository)
    private readonly grantRepository: UserAccessGrantRepository,
  ) {}

  async getUserGrants(tenantId: string, userId: string): Promise<UserAccessGrant[]> {
    return this.grantRepository.findByUser(tenantId, userId);
  }

  async isClientAdmin(tenantId: string, userId: string): Promise<boolean> {
    const grants = await this.getUserGrants(tenantId, userId);

    return grants.some((grant) => grant.role === 'client_admin' && grant.scopeType === 'tenant');
  }

  async canViewOrganization(
    tenantId: string,
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    const grants = await this.getUserGrants(tenantId, userId);

    return grants.some((grant) => {
      if (
        grant.scopeType === 'tenant' &&
        (grant.role === 'client_admin' || grant.role === 'observer')
      ) {
        return true;
      }

      if (
        grant.scopeType === 'organization' &&
        grant.organizationId === organizationId &&
        (grant.role === 'director' || grant.role === 'observer')
      ) {
        return true;
      }

      return false;
    });
  }

  async canViewTeam(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<boolean> {
    const grants = await this.getUserGrants(tenantId, userId);

    return grants.some((grant) => {
      if (
        grant.scopeType === 'tenant' &&
        (grant.role === 'client_admin' || grant.role === 'observer')
      ) {
        return true;
      }

      if (
        grant.scopeType === 'organization' &&
        grant.organizationId === organizationId &&
        (grant.role === 'director' || grant.role === 'observer')
      ) {
        return true;
      }

      if (
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId &&
        (grant.role === 'manager' || grant.role === 'prospector' || grant.role === 'observer')
      ) {
        return true;
      }

      return false;
    });
  }
}
