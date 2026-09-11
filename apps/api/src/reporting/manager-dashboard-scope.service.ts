import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuthorizationService } from '../authorization/authorization.service.js';
import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import type { Campaign } from '../database/schema/campaigns.js';
import type { Organization } from '../database/schema/organizations.js';
import type { Team } from '../database/schema/teams.js';
import type { User } from '../database/schema/users.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import type { ManagerDashboardFilters, ManagerDashboardScope } from './manager-dashboard.types.js';

export interface ResolveManagerDashboardScopeInput {
  tenantId: string;

  userId: string;

  filters: ManagerDashboardFilters;
}

interface LoadedReportingFilters {
  organization: Organization | null;

  team: Team | null;

  campaign: Campaign | null;

  user: User | null;
}

@Injectable()
export class ManagerDashboardScopeService {
  constructor(
    private readonly authorizationService: AuthorizationService,

    private readonly organizationRepository: OrganizationRepository,

    private readonly teamRepository: TeamRepository,

    private readonly userRepository: UserRepository,

    private readonly campaignRepository: CampaignRepository,
  ) {}

  async resolve(input: ResolveManagerDashboardScopeInput): Promise<ManagerDashboardScope> {
    /*
     * Authorization comes first.
     *
     * Do not resolve requested organization/team/
     * campaign IDs until we know that the caller
     * possesses some manager-reporting authority.
     *
     * This prevents prospectors and observers from
     * using the reporting endpoint as an entity
     * existence oracle.
     */
    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    const hasClientAdminAuthority = grants.some(
      (grant) => grant.role === 'client_admin' && grant.scopeType === 'tenant',
    );

    const directorGrants = grants.filter(
      (grant) =>
        grant.role === 'director' &&
        grant.scopeType === 'organization' &&
        grant.organizationId !== null,
    );

    const managerGrants = grants.filter(
      (grant) =>
        grant.role === 'manager' &&
        grant.scopeType === 'team' &&
        grant.organizationId !== null &&
        grant.teamId !== null,
    );

    if (!hasClientAdminAuthority && directorGrants.length === 0 && managerGrants.length === 0) {
      throw new ForbiddenException('User is not authorized to view manager reporting');
    }

    /*
     * Once basic reporting authority is proven,
     * tenant-safe repositories may resolve the
     * requested filters.
     */
    const loaded = await this.loadFilters(input);

    this.validateFilterRelationships(loaded);

    let scope: ManagerDashboardScope;

    /*
     * Deterministic authority precedence:
     *
     * client_admin > director > manager
     *
     * This mirrors the principle already used by
     * manager overrides.
     */
    if (hasClientAdminAuthority) {
      scope = {
        authority: 'client_admin',

        organizationId: null,

        teamId: null,
      };
    } else if (directorGrants.length > 0) {
      scope = this.resolveDirectorScope(directorGrants, loaded);
    } else {
      scope = this.resolveManagerScope(managerGrants, loaded);
    }

    if (loaded.user && input.filters.userId) {
      await this.requireReportableProspector(input.tenantId, input.filters, loaded, scope);
    }

    return scope;
  }

  /*
   * -------------------------------------------------
   * FILTER LOADING
   * -------------------------------------------------
   */

  private async loadFilters(
    input: ResolveManagerDashboardScopeInput,
  ): Promise<LoadedReportingFilters> {
    const [organization, team, campaign, user] = await Promise.all([
      this.loadOrganization(input.tenantId, input.filters.organizationId),

      this.loadTeam(input.tenantId, input.filters.teamId),

      this.loadCampaign(input.tenantId, input.filters.campaignId),

      this.loadUser(input.tenantId, input.filters.userId),
    ]);

    return {
      organization,

      team,

      campaign,

      user,
    };
  }

  private async loadOrganization(
    tenantId: string,
    organizationId: string | undefined,
  ): Promise<Organization | null> {
    if (!organizationId) {
      return null;
    }

    const organization = await this.organizationRepository.findById(tenantId, organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  private async loadTeam(tenantId: string, teamId: string | undefined): Promise<Team | null> {
    if (!teamId) {
      return null;
    }

    const team = await this.teamRepository.findById(tenantId, teamId);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  private async loadCampaign(
    tenantId: string,
    campaignId: string | undefined,
  ): Promise<Campaign | null> {
    if (!campaignId) {
      return null;
    }

    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  private async loadUser(tenantId: string, userId: string | undefined): Promise<User | null> {
    if (!userId) {
      return null;
    }

    const user = await this.userRepository.findById(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /*
   * -------------------------------------------------
   * DIMENSION CONSISTENCY
   * -------------------------------------------------
   *
   * These checks are not authorization.
   *
   * They ensure that the requested dimensions
   * describe a coherent reporting slice.
   */

  private validateFilterRelationships(loaded: LoadedReportingFilters): void {
    if (
      loaded.organization &&
      loaded.team &&
      loaded.team.organizationId !== loaded.organization.id
    ) {
      throw new BadRequestException('Team does not belong to the requested organization');
    }

    if (
      loaded.organization &&
      loaded.campaign &&
      loaded.campaign.organizationId !== loaded.organization.id
    ) {
      throw new BadRequestException('Campaign does not belong to the requested organization');
    }

    if (
      loaded.team &&
      loaded.campaign &&
      loaded.campaign.organizationId !== loaded.team.organizationId
    ) {
      throw new BadRequestException('Campaign and team do not belong to the same organization');
    }
  }

  /*
   * -------------------------------------------------
   * DIRECTOR SCOPE
   * -------------------------------------------------
   *
   * A director grant authorizes exactly one
   * organization.
   *
   * Users may hold multiple director grants.
   *
   * If multiple organizations are available and the
   * request does not identify which organization
   * through organization/team/campaign filters, the
   * API refuses to guess.
   */

  private resolveDirectorScope(
    grants: UserAccessGrant[],
    loaded: LoadedReportingFilters,
  ): ManagerDashboardScope {
    const allowedOrganizationIds = new Set(
      grants.flatMap((grant) => (grant.organizationId ? [grant.organizationId] : [])),
    );

    const requestedOrganizationId =
      loaded.organization?.id ??
      loaded.team?.organizationId ??
      loaded.campaign?.organizationId ??
      null;

    if (requestedOrganizationId) {
      if (!allowedOrganizationIds.has(requestedOrganizationId)) {
        throw new ForbiddenException('Requested reporting scope is outside the user authorization');
      }

      return {
        authority: 'director',

        organizationId: requestedOrganizationId,

        teamId: null,
      };
    }

    if (allowedOrganizationIds.size !== 1) {
      throw new BadRequestException(
        'organizationId is required when reporting authority spans multiple organizations',
      );
    }

    const [organizationId] = allowedOrganizationIds;

    if (!organizationId) {
      throw new ForbiddenException('User is not authorized to view manager reporting');
    }

    return {
      authority: 'director',

      organizationId,

      teamId: null,
    };
  }

  /*
   * -------------------------------------------------
   * MANAGER SCOPE
   * -------------------------------------------------
   *
   * Manager reporting is always exact-team scoped.
   *
   * A user may hold multiple manager grants.
   *
   * organizationId/campaignId may narrow the
   * candidate grants, but if more than one team
   * remains the request must explicitly provide
   * teamId.
   */

  private resolveManagerScope(
    grants: UserAccessGrant[],
    loaded: LoadedReportingFilters,
  ): ManagerDashboardScope {
    let candidates = grants.filter(
      (
        grant,
      ): grant is UserAccessGrant & {
        organizationId: string;
        teamId: string;
      } => grant.organizationId !== null && grant.teamId !== null,
    );

    const requestedOrganizationId =
      loaded.organization?.id ??
      loaded.campaign?.organizationId ??
      loaded.team?.organizationId ??
      null;

    if (requestedOrganizationId) {
      candidates = candidates.filter((grant) => grant.organizationId === requestedOrganizationId);
    }

    if (loaded.team) {
      candidates = candidates.filter((grant) => grant.teamId === loaded.team?.id);
    }

    if (candidates.length === 0) {
      throw new ForbiddenException('Requested reporting scope is outside the user authorization');
    }

    const uniqueTeamScopes = new Map<
      string,
      {
        organizationId: string;
        teamId: string;
      }
    >();

    for (const grant of candidates) {
      uniqueTeamScopes.set(`${grant.organizationId}:${grant.teamId}`, {
        organizationId: grant.organizationId,

        teamId: grant.teamId,
      });
    }

    if (uniqueTeamScopes.size !== 1) {
      throw new BadRequestException(
        'teamId is required when reporting authority spans multiple teams',
      );
    }

    const [scope] = uniqueTeamScopes.values();

    if (!scope) {
      throw new ForbiddenException('User is not authorized to view manager reporting');
    }

    return {
      authority: 'manager',

      organizationId: scope.organizationId,

      teamId: scope.teamId,
    };
  }

  /*
   * -------------------------------------------------
   * USER FILTER AUTHORIZATION
   * -------------------------------------------------
   *
   * The dashboard's per-user dimension means
   * "prospector".
   *
   * A tenant user existing in PostgreSQL is not by
   * itself enough.
   *
   * The target user must hold a prospector team
   * grant inside the effective reporting scope.
   */

  private async requireReportableProspector(
    tenantId: string,
    filters: ManagerDashboardFilters,
    loaded: LoadedReportingFilters,
    scope: ManagerDashboardScope,
  ): Promise<void> {
    if (!loaded.user) {
      return;
    }

    const grants = await this.authorizationService.getUserGrants(tenantId, loaded.user.id);

    const prospectorGrants = grants.filter(
      (
        grant,
      ): grant is UserAccessGrant & {
        organizationId: string;
        teamId: string;
      } =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId !== null &&
        grant.teamId !== null,
    );

    const requestedOrganizationId =
      filters.organizationId ??
      loaded.team?.organizationId ??
      loaded.campaign?.organizationId ??
      null;

    const requestedTeamId = filters.teamId ?? null;

    const isAllowed = prospectorGrants.some((grant) => {
      /*
       * Mandatory authority scope.
       */
      if (scope.organizationId && grant.organizationId !== scope.organizationId) {
        return false;
      }

      if (scope.teamId && grant.teamId !== scope.teamId) {
        return false;
      }

      /*
       * Optional request dimensions.
       */
      if (requestedOrganizationId && grant.organizationId !== requestedOrganizationId) {
        return false;
      }

      if (requestedTeamId && grant.teamId !== requestedTeamId) {
        return false;
      }

      return true;
    });

    if (!isAllowed) {
      throw new ForbiddenException('Requested user is outside the reporting scope');
    }
  }
}
