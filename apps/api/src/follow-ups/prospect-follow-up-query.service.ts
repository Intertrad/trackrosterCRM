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

  teamId: string;

  includeCompleted?: boolean;

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
          grant.teamId === input.teamId,
      )
      .map((grant) => ({
        organizationId: grant.organizationId as string,

        teamId: grant.teamId as string,
      }));

    if (teamScopes.length === 0) {
      throw new ForbiddenException('User does not have access to this prospector team');
    }

    try {
      const followUps = await this.followUpRepository.findActionableQueue(input.tenantId, {
        userId: input.userId,

        teamScopes,

        overdue: input.overdue,
        ...(input.includeCompleted !== undefined
          ? { includeCompleted: input.includeCompleted }
          : {}),

        now: new Date(),

        limit,
      });

      return {
        items: followUps.map((followUp) => ({
          ...toPublicProspectFollowUp(followUp),

          campaignName: followUp.campaignName,

          establishmentName: followUp.establishmentName,
        })),
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

    /*
     * Do not distinguish between:
     *
     * - missing campaign
     * - missing campaign prospect
     * - existing but unauthorized campaign prospect
     *
     * All cases use the same public response to
     * prevent same-tenant resource enumeration.
     */
    if (!campaign) {
      throw new NotFoundException('Campaign prospect not found');
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
     * Current ownership determines whether this
     * prospect is visible now.
     *
     * The resolved durable scope is also passed to
     * the history query. A current Team B assignment
     * must never reveal rows created under an ended
     * Team A assignment to a Team B-only reader.
     */
    const currentAssignment = await this.assignmentRepository.findCurrent(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    const viewScope = await this.authorizationService.resolveViewScope(
      input.tenantId,

      input.userId,

      currentAssignment?.organizationId ?? campaign.organizationId,

      currentAssignment?.teamId,
    );

    /*
     * Existing resources outside the caller's
     * authorized scope are intentionally masked
     * as not found.
     */
    if (!viewScope) {
      throw new NotFoundException('Campaign prospect not found');
    }

    try {
      const followUps = await this.followUpRepository.findByCampaignProspectWithinScope(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
        viewScope,
      );

      return {
        items: followUps.map(toPublicProspectFollowUp),
      };
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }
  }
}
