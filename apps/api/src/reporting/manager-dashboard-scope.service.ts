import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import type { Campaign } from '../database/schema/campaigns.js';
import type { Organization } from '../database/schema/organizations.js';
import type { Team } from '../database/schema/teams.js';
import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import type { User } from '../database/schema/users.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import type { ManagerDashboardFilters, ManagerDashboardScope } from './manager-dashboard.types.js';

const REPORTING_RESOURCE_NOT_FOUND = 'Reporting resource not found';

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
     * Establish caller-level reporting authority
     * before resolving any client-supplied resource
     * identifiers.
     *
     * A caller with no reporting authority receives
     * 403 regardless of whether any supplied IDs
     * exist.
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
     * Tenant-scoped repositories resolve the
     * requested filter entities.
     *
     * Loaders deliberately return null for both an
     * omitted resource and a nonexistent resource.
     * The requested filter object is then used to
     * distinguish omission from lookup failure.
     *
     * This allows every missing reporting resource
     * to use the same public 404 response.
     */
    const loaded = await this.loadFilters(input);

    this.requireRequestedFiltersExist(input.filters, loaded);

    /*
     * Mask existing-but-out-of-scope organization,
     * team and campaign resources before any
     * relationship validation.
     *
     * This prevents:
     *
     * missing resource       -> 404
     * existing out-of-scope  -> 403 / 400
     *
     * from becoming an existence oracle.
     */
    this.requireResourceFiltersWithinAuthority(
      loaded,
      hasClientAdminAuthority,
      directorGrants,
      managerGrants,
    );

    /*
     * userId is a special reporting dimension.
     *
     * It does not mean "any tenant user"; it means a
     * prospector reportable within the caller's
     * authority and all supplied dimensions.
     *
     * Validate it before exposing relationship
     * errors so an out-of-scope user cannot become
     * detectable through 404-vs-400 differences.
     */
    await this.requireRequestedUserWithinAuthority(
      input.tenantId,
      loaded,
      hasClientAdminAuthority,
      directorGrants,
      managerGrants,
    );

    /*
     * At this point every resolved resource is known
     * to be visible within the caller's reporting
     * authority.
     *
     * Relationship validation can therefore safely
     * expose a 400 for an incoherent request.
     */
    this.validateFilterRelationships(loaded);

    /*
     * Deterministic authority precedence:
     *
     * client_admin > director > manager
     */
    if (hasClientAdminAuthority) {
      return {
        authority: 'client_admin',

        organizationId: null,

        teamId: null,
      };
    }

    if (directorGrants.length > 0) {
      return this.resolveDirectorScope(directorGrants, loaded);
    }

    return this.resolveManagerScope(managerGrants, loaded);
  }

  /*
   * -------------------------------------------------
   * FILTER LOADING
   * -------------------------------------------------
   */

  private async loadFilters(
    input: ResolveManagerDashboardScopeInput,
  ): Promise<LoadedReportingFilters> {
    // These repositories can resolve to the request transaction executor.
    // Keep them sequential so one PostgreSQL client never executes concurrent
    // queries when RLS scope is active.
    const organization = await this.loadOrganization(input.tenantId, input.filters.organizationId);
    const team = await this.loadTeam(input.tenantId, input.filters.teamId);
    const campaign = await this.loadCampaign(input.tenantId, input.filters.campaignId);
    const user = await this.loadUser(input.tenantId, input.filters.userId);

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

    return this.organizationRepository.findById(tenantId, organizationId);
  }

  private async loadTeam(tenantId: string, teamId: string | undefined): Promise<Team | null> {
    if (!teamId) {
      return null;
    }

    return this.teamRepository.findById(tenantId, teamId);
  }

  private async loadCampaign(
    tenantId: string,
    campaignId: string | undefined,
  ): Promise<Campaign | null> {
    if (!campaignId) {
      return null;
    }

    return this.campaignRepository.findById(tenantId, campaignId);
  }

  private async loadUser(tenantId: string, userId: string | undefined): Promise<User | null> {
    if (!userId) {
      return null;
    }

    return this.userRepository.findById(tenantId, userId);
  }

  /*
   * Missing organization/team/campaign/user IDs all
   * use one reporting-specific 404 contract.
   *
   * This is intentionally less descriptive than
   * administration APIs because this endpoint
   * accepts several independently enumerable
   * dimensions.
   */
  private requireRequestedFiltersExist(
    filters: ManagerDashboardFilters,
    loaded: LoadedReportingFilters,
  ): void {
    if (filters.organizationId && !loaded.organization) {
      this.reportingResourceNotFound();
    }

    if (filters.teamId && !loaded.team) {
      this.reportingResourceNotFound();
    }

    if (filters.campaignId && !loaded.campaign) {
      this.reportingResourceNotFound();
    }

    if (filters.userId && !loaded.user) {
      this.reportingResourceNotFound();
    }
  }

  /*
   * -------------------------------------------------
   * RESOURCE-SCOPE MASKING
   * -------------------------------------------------
   */

  private requireResourceFiltersWithinAuthority(
    loaded: LoadedReportingFilters,
    hasClientAdminAuthority: boolean,
    directorGrants: UserAccessGrant[],
    managerGrants: UserAccessGrant[],
  ): void {
    /*
     * Tenant client administrators may report over
     * any resource already proven to belong to their
     * tenant.
     */
    if (hasClientAdminAuthority) {
      return;
    }

    /*
     * Authority precedence means a caller with at
     * least one director grant is evaluated using
     * director scope rather than narrower manager
     * grants.
     */
    if (directorGrants.length > 0) {
      const allowedOrganizationIds = new Set(
        directorGrants.flatMap((grant) => (grant.organizationId ? [grant.organizationId] : [])),
      );

      if (loaded.organization && !allowedOrganizationIds.has(loaded.organization.id)) {
        this.reportingResourceNotFound();
      }

      if (loaded.team && !allowedOrganizationIds.has(loaded.team.organizationId)) {
        this.reportingResourceNotFound();
      }

      if (loaded.campaign && !allowedOrganizationIds.has(loaded.campaign.organizationId)) {
        this.reportingResourceNotFound();
      }

      return;
    }

    /*
     * Manager authority is exact-team scoped.
     *
     * Organization and campaign filters may select
     * an organization containing at least one
     * managed team.
     *
     * teamId itself must match an exact manager
     * grant.
     */
    const allowedOrganizationIds = new Set(
      managerGrants.flatMap((grant) => (grant.organizationId ? [grant.organizationId] : [])),
    );

    const allowedTeamIds = new Set(
      managerGrants.flatMap((grant) => (grant.teamId ? [grant.teamId] : [])),
    );

    if (loaded.organization && !allowedOrganizationIds.has(loaded.organization.id)) {
      this.reportingResourceNotFound();
    }

    if (loaded.team && !allowedTeamIds.has(loaded.team.id)) {
      this.reportingResourceNotFound();
    }

    if (loaded.campaign && !allowedOrganizationIds.has(loaded.campaign.organizationId)) {
      this.reportingResourceNotFound();
    }
  }

  /*
   * -------------------------------------------------
   * USER FILTER MASKING
   * -------------------------------------------------
   *
   * A requested user must be a prospector that is
   * reportable within BOTH:
   *
   * - the caller's authority
   * - every supplied reporting dimension
   *
   * Existing users outside that boundary are
   * intentionally indistinguishable from missing
   * users.
   */

  private async requireRequestedUserWithinAuthority(
    tenantId: string,
    loaded: LoadedReportingFilters,
    hasClientAdminAuthority: boolean,
    directorGrants: UserAccessGrant[],
    managerGrants: UserAccessGrant[],
  ): Promise<void> {
    if (!loaded.user) {
      return;
    }

    const targetGrants = await this.authorizationService.getUserGrants(tenantId, loaded.user.id);

    const prospectorGrants = targetGrants.filter(
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

    const directorOrganizationIds = new Set(
      directorGrants.flatMap((grant) => (grant.organizationId ? [grant.organizationId] : [])),
    );

    const managerScopes = new Set(
      managerGrants.flatMap((grant) =>
        grant.organizationId && grant.teamId ? [`${grant.organizationId}:${grant.teamId}`] : [],
      ),
    );

    const isAllowed = prospectorGrants.some((grant) => {
      /*
       * Caller authority.
       */
      if (!hasClientAdminAuthority) {
        if (directorGrants.length > 0) {
          if (!directorOrganizationIds.has(grant.organizationId)) {
            return false;
          }
        } else if (!managerScopes.has(`${grant.organizationId}:${grant.teamId}`)) {
          return false;
        }
      }

      /*
       * Explicit organization filter.
       */
      if (loaded.organization && grant.organizationId !== loaded.organization.id) {
        return false;
      }

      /*
       * Explicit team filter.
       */
      if (
        loaded.team &&
        (grant.organizationId !== loaded.team.organizationId || grant.teamId !== loaded.team.id)
      ) {
        return false;
      }

      /*
       * Campaign belongs to an organization, so a
       * reportable prospector must belong to that
       * same organization.
       */
      if (loaded.campaign && grant.organizationId !== loaded.campaign.organizationId) {
        return false;
      }

      return true;
    });

    if (!isAllowed) {
      this.reportingResourceNotFound();
    }
  }

  /*
   * -------------------------------------------------
   * DIMENSION CONSISTENCY
   * -------------------------------------------------
   *
   * These errors are safe only after all referenced
   * resources have been established as visible to
   * the caller.
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
      /*
       * This should already have been masked by
       * requireResourceFiltersWithinAuthority().
       *
       * Keep the check as defense in depth.
       */
      if (!allowedOrganizationIds.has(requestedOrganizationId)) {
        this.reportingResourceNotFound();
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

    /*
     * An empty candidate set after requested
     * resource resolution means the requested slice
     * is outside this manager's authority.
     *
     * Mask it like a nonexistent reporting resource.
     */
    if (candidates.length === 0) {
      this.reportingResourceNotFound();
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
   * One deliberately generic public response for
   * every requested reporting entity that is either:
   *
   * - nonexistent
   * - cross-tenant
   * - outside caller reporting authority
   * - an existing user who is not reportable as a
   *   prospector in the requested scope
   */
  private reportingResourceNotFound(): never {
    throw new NotFoundException(REPORTING_RESOURCE_NOT_FOUND);
  }
}
