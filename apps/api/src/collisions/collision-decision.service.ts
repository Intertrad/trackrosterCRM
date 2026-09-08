import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
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
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    /*
     * The target campaign prospect must first be
     * valid and the caller must be eligible to work it.
     */
    const { establishmentId } = await this.reservationService.requireReservationEligibility({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    /*
     * Priority 1:
     * ACTIVE_RESERVATION
     *
     * Somebody is actively working this canonical
     * establishment right now.
     */
    let reservation: ProspectReservation | null;

    try {
      reservation = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (reservation) {
      const isExactTarget =
        reservation.campaignId === input.campaignId &&
        reservation.campaignProspectId === input.campaignProspectId;

      /*
       * The caller may continue working when they
       * already own the reservation for this exact
       * campaign prospect.
       */
      if (isExactTarget && reservation.userId === input.userId) {
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

        conflict: this.toReservationConflict(reservation),
      };
    }

    /*
     * Priority 2:
     * PLANNED_ACTION
     *
     * A pending follow-up represents an explicit
     * future or overdue commitment to contact this
     * canonical establishment.
     *
     * The repository ignores only the caller's own
     * pending follow-up on this exact target.
     */
    let conflictingFollowUp;

    try {
      conflictingFollowUp = await this.followUpRepository.findConflictingPendingByEstablishment(
        input.tenantId,
        establishmentId,
        input.campaignId,
        input.campaignProspectId,
        input.userId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (conflictingFollowUp) {
      return {
        decision: 'block',

        reasonCode: 'PLANNED_ACTION',

        establishmentId,

        conflict: this.toPlannedActionConflict(conflictingFollowUp),
      };
    }

    /*
     * Priority 3:
     * RECENT_CONTACT
     *
     * No active reservation or conflicting planned
     * action exists, so evaluate cooling-off.
     */
    const coolingOff = await this.coolingOffService.evaluate(input.tenantId, establishmentId);

    if (coolingOff.active && coolingOff.activity && coolingOff.expiresAt) {
      return {
        decision: 'block',

        reasonCode: 'RECENT_CONTACT',

        establishmentId,

        conflict: {
          activityId: coolingOff.activity.id,

          activityType: coolingOff.activity.type,

          occurredAt: coolingOff.activity.occurredAt.toISOString(),

          expiresAt: coolingOff.expiresAt.toISOString(),
        },
      };
    }

    /*
     * Priority 4:
     * ACTIVE_ASSIGNMENT
     *
     * Another active assignment exists for the same
     * canonical establishment.
     *
     * Assignment alone is advisory, therefore WARN
     * rather than BLOCK.
     */
    let conflictingAssignment;

    try {
      conflictingAssignment = await this.assignmentRepository.findConflictingCurrentByEstablishment(
        input.tenantId,
        establishmentId,
        input.campaignId,
        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (conflictingAssignment) {
      return {
        decision: 'warn',

        reasonCode: 'ACTIVE_ASSIGNMENT',

        establishmentId,

        conflict: this.toAssignmentConflict(conflictingAssignment),
      };
    }

    /*
     * No collision was found.
     */
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
