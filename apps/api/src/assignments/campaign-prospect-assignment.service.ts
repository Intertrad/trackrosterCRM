import { assertAssignmentCapacity } from '../memberships/assignment-capacity.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { DATABASE } from '../database/database.constants.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import type { CampaignProspect } from '../database/schema/campaign-prospects.js';
import type { Campaign } from '../database/schema/campaigns.js';
import type { Database } from '../database/database.types.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { CampaignProspectAssignmentRepository } from './campaign-prospect-assignment.repository.js';

export interface AssignCampaignProspectInput {
  tenantId: string;

  /*
   * Authenticated administrator performing
   * the ownership mutation.
   *
   * Never sourced from the request body.
   */
  actorUserId: string;

  campaignId: string;

  campaignProspectId: string;

  teamId: string;

  assignedUserId?: string | null;
}

export interface UnassignCampaignProspectInput {
  tenantId: string;

  actorUserId: string;

  campaignId: string;

  campaignProspectId: string;
}

interface ValidatedAssignmentTarget {
  campaign: Campaign;

  prospect: CampaignProspect;

  assignedUserId: string | null;
}

@Injectable()
export class CampaignProspectAssignmentService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly campaignRepository: CampaignRepository,

    private readonly campaignProspectRepository: CampaignProspectRepository,

    private readonly teamRepository: TeamRepository,

    private readonly userRepository: UserRepository,

    private readonly authorizationService: AuthorizationService,

    private readonly auditService: AuditService,
  ) {}

  async assign(input: AssignCampaignProspectInput): Promise<CampaignProspectAssignment> {
    const target = await this.validateTarget(input);

    try {
      return await this.database.transaction(async (transaction) => {
        const team = await this.teamRepository.findByIdForShare(
          input.tenantId,
          input.teamId,
          transaction,
        );
        if (!team || team.status !== 'active') throw new ConflictException('Team is not active');
        await assertAssignmentCapacity(
          transaction,
          input.tenantId,
          target.assignedUserId,
          input.teamId,
          input.campaignProspectId,
        );
        const current = await this.assignmentRepository.findCurrent(
          input.tenantId,
          input.campaignId,
          input.campaignProspectId,
          transaction,
        );

        if (current) {
          throw new ConflictException('Campaign prospect already has an active assignment');
        }

        const assignment = await this.assignmentRepository.create(
          {
            tenantId: input.tenantId,

            campaignId: input.campaignId,

            campaignProspectId: input.campaignProspectId,

            organizationId: target.campaign.organizationId,

            teamId: input.teamId,

            assignedUserId: target.assignedUserId,
          },

          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,

            actorType: 'user',

            actorUserId: input.actorUserId,

            action: 'assignment.assigned',

            resourceType: 'campaign_prospect',

            resourceId: input.campaignProspectId,

            metadata: {
              assignmentId: assignment.id,

              campaignId: input.campaignId,

              organizationId: assignment.organizationId,

              teamId: assignment.teamId,

              assignedUserId: assignment.assignedUserId,
            },
          },

          transaction,
        );

        return assignment;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Campaign prospect already has an active assignment');
      }

      throw error;
    }
  }

  async reassign(input: AssignCampaignProspectInput): Promise<CampaignProspectAssignment> {
    const target = await this.validateTarget(input);

    try {
      return await this.database.transaction(async (transaction) => {
        const team = await this.teamRepository.findByIdForShare(
          input.tenantId,
          input.teamId,
          transaction,
        );
        if (!team || team.status !== 'active') throw new ConflictException('Team is not active');
        await assertAssignmentCapacity(
          transaction,
          input.tenantId,
          target.assignedUserId,
          input.teamId,
          input.campaignProspectId,
        );
        const current = await this.assignmentRepository.findCurrentForUpdate(
          input.tenantId,
          input.campaignId,
          input.campaignProspectId,
          transaction,
        );

        if (!current) {
          throw new ConflictException('Campaign prospect is not currently assigned');
        }

        await this.requireAssignmentAuthority(
          input.tenantId,
          input.actorUserId,
          current.organizationId,
          current.teamId,
        );

        /*
         * Do not create meaningless assignment
         * history or audit evidence when ownership
         * has not actually changed.
         */
        if (current.teamId === input.teamId && current.assignedUserId === target.assignedUserId) {
          return current;
        }

        const changedAt = new Date();

        const ended = await this.assignmentRepository.endCurrent(
          input.tenantId,
          input.campaignId,
          input.campaignProspectId,
          changedAt,
          transaction,
        );

        if (!ended) {
          throw new ConflictException('Active assignment changed during reassignment');
        }

        const assignment = await this.assignmentRepository.create(
          {
            tenantId: input.tenantId,

            campaignId: input.campaignId,

            campaignProspectId: input.campaignProspectId,

            organizationId: target.campaign.organizationId,

            teamId: input.teamId,

            assignedUserId: target.assignedUserId,

            assignedAt: changedAt,
          },

          transaction,
        );

        await this.auditService.record(
          {
            tenantId: input.tenantId,

            actorType: 'user',

            actorUserId: input.actorUserId,

            action: 'assignment.reassigned',

            resourceType: 'campaign_prospect',

            resourceId: input.campaignProspectId,

            metadata: {
              campaignId: input.campaignId,

              previousAssignmentId: current.id,

              newAssignmentId: assignment.id,

              previousTeamId: current.teamId,

              newTeamId: assignment.teamId,

              previousAssignedUserId: current.assignedUserId,

              newAssignedUserId: assignment.assignedUserId,
            },
          },

          transaction,
        );

        return assignment;
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Campaign prospect assignment changed concurrently');
      }

      throw error;
    }
  }

  async unassign(input: UnassignCampaignProspectInput): Promise<CampaignProspectAssignment> {
    return this.database.transaction(async (transaction) => {
      const current = await this.assignmentRepository.findCurrentForUpdate(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
        transaction,
      );

      if (!current) {
        throw new ConflictException('Campaign prospect is not currently assigned');
      }

      await this.requireAssignmentAuthority(
        input.tenantId,
        input.actorUserId,
        current.organizationId,
        current.teamId,
      );

      /*
       * Only validate the mutable campaign/prospect
       * after the caller has proven authority over the
       * current assignment. This avoids leaking scoped
       * resource details to unauthorized callers.
       */
      await this.requireAssignableProspect(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );

      const changedAt = new Date();

      /*
       * endCurrent() is itself conditional on
       * ended_at IS NULL.
       *
       * This means concurrent unassign/reassign
       * attempts cannot both successfully end the
       * same current assignment.
       */
      const assignment = await this.assignmentRepository.endCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
        changedAt,
        transaction,
      );

      if (!assignment) {
        throw new ConflictException('Campaign prospect is not currently assigned');
      }

      /*
       * Mutation and immutable audit evidence belong
       * to the same transaction.
       *
       * If audit persistence fails, the assignment
       * termination must roll back too.
       */
      await this.auditService.record(
        {
          tenantId: input.tenantId,

          actorType: 'user',

          actorUserId: input.actorUserId,

          action: 'assignment.unassigned',

          resourceType: 'campaign_prospect',

          resourceId: input.campaignProspectId,

          metadata: {
            assignmentId: assignment.id,

            campaignId: input.campaignId,

            organizationId: assignment.organizationId,

            teamId: assignment.teamId,

            assignedUserId: assignment.assignedUserId,
          },
        },

        transaction,
      );

      return assignment;
    });
  }

  async getCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<CampaignProspectAssignment | null> {
    await this.requireCampaignProspect(tenantId, campaignId, campaignProspectId);

    return this.assignmentRepository.findCurrent(tenantId, campaignId, campaignProspectId);
  }

  async getHistory(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<CampaignProspectAssignment[]> {
    await this.requireCampaignProspect(tenantId, campaignId, campaignProspectId);

    return this.assignmentRepository.findHistory(tenantId, campaignId, campaignProspectId);
  }

  private async validateTarget(
    input: AssignCampaignProspectInput,
  ): Promise<ValidatedAssignmentTarget> {
    const { campaign, prospect } = await this.requireAssignableProspect(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    const team = await this.teamRepository.findById(input.tenantId, input.teamId);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.organizationId !== campaign.organizationId) {
      throw new BadRequestException('Team does not belong to campaign organization');
    }

    if (team.status !== 'active') {
      throw new ConflictException('Team is not active');
    }

    await this.requireAssignmentAuthority(
      input.tenantId,
      input.actorUserId,
      campaign.organizationId,
      input.teamId,
    );

    const assignedUserId = input.assignedUserId ?? null;

    if (assignedUserId) {
      await this.requireAssignableUser(
        input.tenantId,
        campaign.organizationId,
        input.teamId,
        assignedUserId,
      );
    }

    return {
      campaign,
      prospect,
      assignedUserId,
    };
  }

  private async requireAssignmentAuthority(
    tenantId: string,
    actorUserId: string,
    organizationId: string,
    teamId: string,
  ): Promise<void> {
    const authority = await this.authorizationService.getAssignmentAuthority(
      tenantId,
      actorUserId,
      organizationId,
      teamId,
    );

    if (!authority) {
      throw new ForbiddenException('Assignment management access required for selected team');
    }
  }

  private async requireAssignableProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<{
    campaign: Campaign;
    prospect: CampaignProspect;
  }> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status === 'completed' || campaign.status === 'archived') {
      throw new ConflictException('Campaign is no longer assignable');
    }

    const prospect = await this.campaignProspectRepository.findById(
      tenantId,
      campaignId,
      campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }

    if (prospect.status !== 'active') {
      throw new ConflictException('Excluded campaign prospect cannot be assigned');
    }

    return {
      campaign,
      prospect,
    };
  }

  private async requireCampaignProspect(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<void> {
    const campaign = await this.campaignRepository.findById(tenantId, campaignId);

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const prospect = await this.campaignProspectRepository.findById(
      tenantId,
      campaignId,
      campaignProspectId,
    );

    if (!prospect) {
      throw new NotFoundException('Campaign prospect not found');
    }
  }

  private async requireAssignableUser(
    tenantId: string,
    organizationId: string,
    teamId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.userRepository.findById(tenantId, userId);

    if (!user) {
      throw new NotFoundException('Assigned user not found');
    }

    if (user.status !== 'active') {
      throw new ConflictException('Assigned user is not active');
    }

    const grants = await this.authorizationService.getUserGrants(tenantId, userId);

    const isTeamProspector = grants.some(
      (grant) =>
        grant.role === 'prospector' &&
        grant.scopeType === 'team' &&
        grant.organizationId === organizationId &&
        grant.teamId === teamId,
    );

    if (!isTeamProspector) {
      throw new BadRequestException('Assigned user is not a prospector for the selected team');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('code' in error && error.code === '23505') {
      return true;
    }

    if (!('cause' in error)) {
      return false;
    }

    const cause = error.cause;

    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
  }
}
