import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import type {
  ActiveAssignmentCollisionConflict,
  CollisionDecisionResult,
  PlannedActionCollisionConflict,
} from './collision.types.js';

export interface EvaluateBusinessCollisionInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  targetOrganizationId: string;
}

/*
 * Canonical evaluator for PERSISTED business collisions.
 *
 * It deliberately knows nothing about:
 *
 * - reservation eligibility
 * - Redis
 * - override records
 * - HTTP
 *
 * Active reservations remain outside this service because
 * they are real-time concurrency locks rather than an
 * overrideable business rule.
 */
@Injectable()
export class CollisionBusinessDecisionService {
  constructor(
    private readonly coolingOffService: CoolingOffService,

    private readonly followUpRepository: ProspectFollowUpRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly coordinationCollisionPolicyService: CoordinationCollisionPolicyService,
  ) {}

  async evaluate(input: EvaluateBusinessCollisionInput): Promise<CollisionDecisionResult> {
    /*
     * Priority 1:
     * PLANNED_ACTION
     */
    let conflictingFollowUps;

    try {
      conflictingFollowUps =
        await this.followUpRepository.findConflictingPendingCandidatesByEstablishment(
          input.tenantId,
          input.establishmentId,
          input.campaignId,
          input.campaignProspectId,
          input.userId,
        );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    for (const followUp of conflictingFollowUps) {
      const coordination = await this.coordinationCollisionPolicyService.evaluate({
        tenantId: input.tenantId,

        targetOrganizationId: input.targetOrganizationId,

        conflictingOrganizationId: followUp.organizationId,

        collisionType: 'planned_action',
      });

      if (coordination.action === 'ignore') {
        continue;
      }

      return {
        decision: 'block',

        reasonCode: 'PLANNED_ACTION',

        establishmentId: input.establishmentId,

        conflict: this.toPlannedActionConflict(followUp),
      };
    }

    /*
     * Priority 2:
     * RECENT_CONTACT
     *
     * Evaluate every applicable activity and retain
     * the collision whose cooling-off window expires
     * latest.
     *
     * This is important for deterministic override
     * fingerprints.
     */
    let activities;

    try {
      activities = await this.prospectActivityRepository.findCandidatesByEstablishment(
        input.tenantId,
        input.establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    const now = new Date();

    let strongestRecentContact: {
      activity: (typeof activities)[number];

      expiresAt: Date;
    } | null = null;

    for (const activity of activities) {
      const coordination = await this.coordinationCollisionPolicyService.evaluate({
        tenantId: input.tenantId,

        targetOrganizationId: input.targetOrganizationId,

        conflictingOrganizationId: activity.organizationId,

        collisionType: 'recent_contact',
      });

      if (coordination.action === 'ignore') {
        continue;
      }

      let coolingOff;

      if (coordination.action === 'delayed') {
        if (coordination.delayMinutes === null || coordination.delayMinutes <= 0) {
          throw new ServiceUnavailableException('Collision service is unavailable');
        }

        coolingOff = this.coolingOffService.evaluateActivity(
          activity,
          now,
          coordination.delayMinutes,
        );
      } else {
        coolingOff = this.coolingOffService.evaluateActivity(activity, now);
      }

      if (!coolingOff.active || !coolingOff.expiresAt) {
        continue;
      }

      if (
        !strongestRecentContact ||
        coolingOff.expiresAt.getTime() > strongestRecentContact.expiresAt.getTime()
      ) {
        strongestRecentContact = {
          activity,

          expiresAt: coolingOff.expiresAt,
        };
      }
    }

    if (strongestRecentContact) {
      return {
        decision: 'block',

        reasonCode: 'RECENT_CONTACT',

        establishmentId: input.establishmentId,

        conflict: {
          activityId: strongestRecentContact.activity.id,

          activityType: strongestRecentContact.activity.type,

          occurredAt: strongestRecentContact.activity.occurredAt.toISOString(),

          expiresAt: strongestRecentContact.expiresAt.toISOString(),
        },
      };
    }

    /*
     * Priority 3:
     * ACTIVE_ASSIGNMENT
     *
     * INDEPENDENT -> ignore
     * SHARED      -> warn
     * DELAYED     -> warn
     * COORDINATED -> block
     */
    let conflictingAssignments;

    try {
      conflictingAssignments =
        await this.assignmentRepository.findConflictingCurrentCandidatesByEstablishment(
          input.tenantId,
          input.establishmentId,
          input.campaignId,
          input.campaignProspectId,
        );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    let warningAssignment: (typeof conflictingAssignments)[number] | null = null;

    for (const conflictingAssignment of conflictingAssignments) {
      const coordination = await this.coordinationCollisionPolicyService.evaluate({
        tenantId: input.tenantId,

        targetOrganizationId: input.targetOrganizationId,

        conflictingOrganizationId: conflictingAssignment.organizationId,

        collisionType: 'active_assignment',
      });

      if (coordination.action === 'ignore') {
        continue;
      }

      if (coordination.action === 'block') {
        return {
          decision: 'block',

          reasonCode: 'ACTIVE_ASSIGNMENT',

          establishmentId: input.establishmentId,

          conflict: this.toAssignmentConflict(conflictingAssignment),
        };
      }

      if (coordination.action === 'warn' && !warningAssignment) {
        warningAssignment = conflictingAssignment;
      }
    }

    if (warningAssignment) {
      return {
        decision: 'warn',

        reasonCode: 'ACTIVE_ASSIGNMENT',

        establishmentId: input.establishmentId,

        conflict: this.toAssignmentConflict(warningAssignment),
      };
    }

    return {
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId: input.establishmentId,

      conflict: null,
    };
  }

  private toPlannedActionConflict(followUp: {
    id: string;

    campaignId: string;

    campaignProspectId: string;

    assignmentId: string;

    assignedUserId: string | null;

    dueAt: Date;
  }): PlannedActionCollisionConflict {
    return {
      followUpId: followUp.id,

      campaignId: followUp.campaignId,

      campaignProspectId: followUp.campaignProspectId,

      assignmentId: followUp.assignmentId,

      assignedUserId: followUp.assignedUserId,

      dueAt: followUp.dueAt.toISOString(),
    };
  }

  private toAssignmentConflict(assignment: {
    id: string;

    campaignId: string;

    campaignProspectId: string;

    organizationId: string;

    teamId: string;

    assignedUserId: string | null;

    assignedAt: Date;
  }): ActiveAssignmentCollisionConflict {
    return {
      assignmentId: assignment.id,

      campaignId: assignment.campaignId,

      campaignProspectId: assignment.campaignProspectId,

      organizationId: assignment.organizationId,

      teamId: assignment.teamId,

      assignedUserId: assignment.assignedUserId,

      assignedAt: assignment.assignedAt.toISOString(),
    };
  }
}
