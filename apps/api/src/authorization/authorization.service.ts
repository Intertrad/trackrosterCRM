import { Inject, Injectable } from '@nestjs/common';

import type { UserAccessGrant, UserRole } from '../database/schema/user-access-grants.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

export type OverrideAuthorityRole = Extract<UserRole, 'client_admin' | 'director' | 'manager'>;

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

  /*
   * Returns the exact authority under which an
   * override may be approved.
   *
   * Authority precedence is intentionally:
   *
   * client_admin > director > manager
   *
   * This gives us a deterministic authority
   * snapshot when a user happens to have more
   * than one valid grant.
   */
  async getOverrideAuthority(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<OverrideAuthorityRole | null> {
    const grants = await this.getUserGrants(tenantId, userId);

    const isClientAdmin = grants.some(
      (grant) => grant.role === 'client_admin' && grant.scopeType === 'tenant',
    );

    if (isClientAdmin) {
      return 'client_admin';
    }

    const isDirector = grants.some(
      (grant) =>
        grant.role === 'director' &&
        grant.scopeType === 'organization' &&
        grant.organizationId === organizationId,
    );

    if (isDirector) {
      return 'director';
    }

    const isManager = grants.some(
      (grant) =>
        grant.role === 'manager' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (isManager) {
      return 'manager';
    }

    return null;
  }

  async canOverrideTeam(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<boolean> {
    const authority = await this.getOverrideAuthority(tenantId, userId, organizationId, teamId);

    return authority !== null;
  }
}
