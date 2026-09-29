import { Inject, Injectable } from '@nestjs/common';

import type { UserAccessGrant, UserRole } from '../database/schema/user-access-grants.js';
import type { ResolvedViewScope } from './access-grant.types.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

export type OverrideAuthorityRole = Extract<UserRole, 'client_admin' | 'director' | 'manager'>;

export type AssignmentAuthorityRole = Extract<UserRole, 'client_admin' | 'director' | 'manager'>;

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
    const scope = await this.resolveViewScope(tenantId, userId, organizationId);

    return scope !== null;
  }

  async canViewTeam(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<boolean> {
    const scope = await this.resolveViewScope(tenantId, userId, organizationId, teamId);

    return scope !== null;
  }

  /*
   * Resolve the broadest durable read grant that
   * authorizes one organization/team resource.
   *
   * Returning the effective scope, rather than only
   * a boolean, lets repositories repeat the same
   * boundary in SQL for defense in depth.
   *
   * Precedence is intentionally:
   *
   * tenant > organization > team
   */
  async resolveViewScope(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId?: string,
  ): Promise<ResolvedViewScope | null> {
    const grants = await this.getUserGrants(tenantId, userId);

    const hasTenantView = grants.some(
      (grant) =>
        grant.scopeType === 'tenant' &&
        (grant.role === 'client_admin' || grant.role === 'observer'),
    );

    if (hasTenantView) {
      return {
        scopeType: 'tenant',

        organizationId: null,

        teamId: null,
      };
    }

    const hasOrganizationView = grants.some(
      (grant) =>
        grant.scopeType === 'organization' &&
        grant.organizationId === organizationId &&
        (grant.role === 'director' || grant.role === 'observer'),
    );

    if (hasOrganizationView) {
      return {
        scopeType: 'organization',

        organizationId,

        teamId: null,
      };
    }

    if (!teamId) {
      return null;
    }

    const hasTeamView = grants.some(
      (grant) =>
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId &&
        (grant.role === 'manager' || grant.role === 'prospector' || grant.role === 'observer'),
    );

    if (!hasTeamView) {
      return null;
    }

    return {
      scopeType: 'team',

      organizationId,

      teamId,
    };
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

  async hasAnyOverrideAuthority(tenantId: string, userId: string): Promise<boolean> {
    const grants = await this.getUserGrants(tenantId, userId);

    return grants.some((grant) => {
      if (grant.role === 'client_admin' && grant.scopeType === 'tenant') {
        return true;
      }

      if (
        grant.role === 'director' &&
        grant.scopeType === 'organization' &&
        grant.organizationId !== null
      ) {
        return true;
      }

      if (
        grant.role === 'manager' &&
        grant.scopeType === 'team' &&
        grant.organizationId !== null &&
        grant.teamId !== null
      ) {
        return true;
      }

      return false;
    });
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

  /*
   * Assignment ownership changes use the same
   * hierarchy as other team-management mutations:
   *
   * client admin > organization director > team manager.
   *
   * Keep this separate from override authority so the
   * two capabilities can diverge later without changing
   * assignment call sites.
   */
  async getAssignmentAuthority(
    tenantId: string,
    userId: string,
    organizationId: string,
    teamId: string,
  ): Promise<AssignmentAuthorityRole | null> {
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
}
