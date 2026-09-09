import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import type {
  ActiveAssignmentCollisionConflict,
  ActiveReservationCollisionConflict,
  CollisionDecisionResult,
  PlannedActionCollisionConflict,
} from './collision.types.js';

export interface EvaluateCollisionInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;
}

@Injectable()
export class CollisionDecisionService {
  constructor(
    private readonly reservationRepository: ReservationRepository,

    private readonly reservationService: ReservationService,

    private readonly coolingOffService: CoolingOffService,

    private readonly followUpRepository: ProspectFollowUpRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly coordinationCollisionPolicyService: CoordinationCollisionPolicyService,

    private readonly reservationCoordinationScopeService: ReservationCoordinationScopeService,
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.userId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    const targetOrganizationId = assignment.organizationId;

    /*
     * Priority 1A:
     * Exact reservation.
     *
     * Check this first so the existing owner of
     * this exact campaign prospect gets the same
     * idempotent behavior as POST /reservation.
     */
    let exactReservation: ProspectReservation | null;

    try {
      exactReservation = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (exactReservation) {
      const isSameOwner =
        exactReservation.userId === input.userId && exactReservation.assignmentId === assignment.id;

      if (isSameOwner) {
        return {
          decision: 'allow',

          reasonCode: 'NO_COLLISION',

          establishmentId,

          conflict: null,
        };
      }

      return {
        decision: 'block',

        reasonCode: 'ACTIVE_RESERVATION',

        establishmentId,

        conflict: this.toReservationConflict(exactReservation),
      };
    }

    /*
     * Priority 1B:
     * Legacy TR-016 reservation compatibility.
     *
     * Old tenant-wide Redis locks may briefly exist
     * during migration. They remain authoritative
     * until their TTL expires.
     */
    let legacyReservation: ProspectReservation | null;

    try {
      legacyReservation = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (legacyReservation) {
      return {
        decision: 'block',

        reasonCode: 'ACTIVE_RESERVATION',

        establishmentId,

        conflict: this.toReservationConflict(legacyReservation),
      };
    }

    /*
     * Resolve the organizations whose reservation
     * locks conflict with the target organization.
     *
     * INDEPENDENT organizations are excluded.
     */
    let blockingOrganizationIds: string[];

    try {
      const scope = await this.reservationCoordinationScopeService.resolve(
        input.tenantId,
        targetOrganizationId,
      );

      blockingOrganizationIds = scope.blockingOrganizationIds;
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    /*
     * Priority 1C:
     * Organization-scoped active reservations.
     */
    let reservationCandidates: ProspectReservation[];

    try {
      reservationCandidates = await this.reservationRepository.findCurrentCandidatesByOrganizations(
        input.tenantId,
        establishmentId,
        blockingOrganizationIds,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (reservationCandidates.length > 0) {
      return {
        decision: 'block',

        reasonCode: 'ACTIVE_RESERVATION',

        establishmentId,

        conflict: this.toReservationConflict(reservationCandidates[0]!),
      };
    }

    /*
     * Priority 2:
     * PLANNED_ACTION
     */
    let conflictingFollowUps;

    try {
      conflictingFollowUps =
        await this.followUpRepository.findConflictingPendingCandidatesByEstablishment(
          input.tenantId,
          establishmentId,
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

        targetOrganizationId,

        conflictingOrganizationId: followUp.organizationId,

        collisionType: 'planned_action',
      });

      if (coordination.action === 'ignore') {
        continue;
      }

      return {
        decision: 'block',

        reasonCode: 'PLANNED_ACTION',

        establishmentId,

        conflict: this.toPlannedActionConflict(followUp),
      };
    }

    /*
     * Priority 3:
     * RECENT_CONTACT
     */
    let activities;

    try {
      activities = await this.prospectActivityRepository.findCandidatesByEstablishment(
        input.tenantId,
        establishmentId,
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

        targetOrganizationId,

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

        establishmentId,

        conflict: {
          activityId: strongestRecentContact.activity.id,

          activityType: strongestRecentContact.activity.type,

          occurredAt: strongestRecentContact.activity.occurredAt.toISOString(),

          expiresAt: strongestRecentContact.expiresAt.toISOString(),
        },
      };
    }

    /*
     * Priority 4:
     * ACTIVE_ASSIGNMENT
     *
     * INDEPENDENT → ignore
     * SHARED      → warn
     * DELAYED     → warn
     * COORDINATED → block
     */
    let conflictingAssignments;

    try {
      conflictingAssignments =
        await this.assignmentRepository.findConflictingCurrentCandidatesByEstablishment(
          input.tenantId,
          establishmentId,
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

        targetOrganizationId,

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

          establishmentId,

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

        establishmentId,

        conflict: this.toAssignmentConflict(warningAssignment),
      };
    }

    return {
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    };
  }

  private toReservationConflict(
    reservation: ProspectReservation,
  ): ActiveReservationCollisionConflict {
    return {
      reservationId: reservation.reservationId,

      campaignId: reservation.campaignId,

      campaignProspectId: reservation.campaignProspectId,

      assignmentId: reservation.assignmentId,

      teamId: reservation.teamId,

      userId: reservation.userId,

      acquiredAt: reservation.acquiredAt,

      expiresAt: reservation.expiresAt,
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
