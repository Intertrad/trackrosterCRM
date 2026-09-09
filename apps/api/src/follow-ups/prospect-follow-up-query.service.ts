import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';
import {
  toPublicProspectFollowUp,
  type ProspectFollowUpListResponse,
  type ProspectFollowUpQueueResponse,
} from './prospect-follow-up.types.js';

export interface ListProspectFollowUpsInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;
}

export interface ListFollowUpQueueInput {
  tenantId: string;

  userId: string;

  overdue?: boolean;

  limit?: number;
}

@Injectable()
export class ProspectFollowUpQueryService {
  constructor(
    private readonly followUpRepository: ProspectFollowUpRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly campaignProspectRepository: CampaignProspectRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly authorizationService: AuthorizationService,
  ) {}

  async listQueue(input: ListFollowUpQueueInput): Promise<ProspectFollowUpQueueResponse> {
    const limit = input.limit ?? 50;

    /*
     * The operational queue is currently a
     * prospector feature.
     *
     * Managers/directors get aggregate workflow
     * views later through dashboard/reporting
     * features instead of silently inheriting a
     * prospector's work queue.
     */
    const grants = await this.authorizationService.getUserGrants(input.tenantId, input.userId);

    const teamScopes = grants
      .filter(
        (grant) =>
          grant.role === 'prospector' &&
          grant.scopeType === 'team' &&
          grant.organizationId !== null &&
          grant.teamId !== null,
      )
      .map((grant) => ({
        organizationId: grant.organizationId as string,

        teamId: grant.teamId as string,
      }));

    if (teamScopes.length === 0) {
      throw new ForbiddenException('User does not have a prospector team scope');
    }

    try {
      const followUps = await this.followUpRepository.findActionableQueue(input.tenantId, {
        userId: input.userId,

        teamScopes,

        overdue: input.overdue,

        now: new Date(),

        limit,
      });

      return {
        items: followUps.map(toPublicProspectFollowUp),
      };
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }
  }

  async listByProspect(input: ListProspectFollowUpsInput): Promise<ProspectFollowUpListResponse> {
    /*
     * Historical follow-up reads intentionally
     * do not reuse reservation eligibility.
     *
     * Completed/archived campaigns and historical
     * follow-ups remain readable to authorized
     * users.
     */
    const campaign = await this.campaignRepository.findById(input.tenantId, input.campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    /*
     * Current ownership controls current read
     * access, while historical follow-up rows
     * remain visible once access is granted.
     */
    const currentAssignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    let canView: boolean;

    if (currentAssignment) {
      canView = await this.authorizationService.canViewTeam(
        input.tenantId,
        input.userId,
        currentAssignment.organizationId,
        currentAssignment.teamId,
      );
    } else {
      canView = await this.authorizationService.canViewOrganization(
        input.tenantId,
        input.userId,
        campaign.organizationId,
      );
    }

    if (!canView) {
      throw new ForbiddenException('User cannot view prospect follow-ups');
    }

    try {
      const followUps = await this.followUpRepository.findByCampaignProspect(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );

      return {
        items: followUps.map(toPublicProspectFollowUp),
      };
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }
  }
}
