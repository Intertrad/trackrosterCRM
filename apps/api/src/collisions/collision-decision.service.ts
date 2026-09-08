import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import type {
  ActiveReservationCollisionConflict,
  CollisionDecisionResult,
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
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    /*
     * Eligibility remains the first gate.
     */
    const { establishmentId } = await this.reservationService.requireReservationEligibility({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    let reservation: ProspectReservation | null;

    try {
      reservation = await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        establishmentId,
      );
    } catch {
      /*
       * Active-reservation protection is
       * safety-critical and fails closed.
       */
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (reservation) {
      const isExactTarget =
        reservation.campaignId === input.campaignId &&
        reservation.campaignProspectId === input.campaignProspectId;

      /*
       * The caller may continue working while
       * holding their own reservation for this
       * exact prospect.
       *
       * We deliberately return before checking
       * cooling-off because activities recorded
       * during this active work session should
       * not block the same worker.
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
     * No one is actively working the
     * establishment, so now evaluate the
     * historical cooling-off rule.
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
}
