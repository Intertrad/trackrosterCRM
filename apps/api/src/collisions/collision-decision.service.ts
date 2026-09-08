import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import type { CollisionConflict, CollisionDecisionResult } from './collision.types.js';

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
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    /*
     * Eligibility remains the first gate.
     *
     * This verifies:
     * - campaign is active
     * - campaign prospect is active
     * - current assignment exists
     * - assigned team is active
     * - caller is active
     * - caller has exact-team prospector access
     * - individual ownership is respected
     *
     * It also gives us the canonical
     * establishment ID.
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
       * Collision verification is safety-critical.
       *
       * Redis failure must never silently
       * become ALLOW.
       */
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    if (!reservation) {
      return {
        decision: 'allow',

        reasonCode: 'NO_COLLISION',

        establishmentId,

        conflict: null,
      };
    }

    const isExactTarget =
      reservation.campaignId === input.campaignId &&
      reservation.campaignProspectId === input.campaignProspectId;

    /*
     * The authenticated user's existing
     * reservation for this exact workflow
     * context is not a collision.
     */
    if (isExactTarget && reservation.userId === input.userId) {
      return {
        decision: 'allow',

        reasonCode: 'NO_COLLISION',

        establishmentId,

        conflict: null,
      };
    }

    /*
     * Everything else means the canonical
     * establishment is currently being worked.
     *
     * This includes:
     *
     * - another user on the same campaign prospect
     * - another campaign prospect
     * - another campaign context owned by the
     *   same user
     */
    return {
      decision: 'block',

      reasonCode: 'ACTIVE_RESERVATION',

      establishmentId,

      conflict: this.toConflict(reservation),
    };
  }

  private toConflict(reservation: ProspectReservation): CollisionConflict {
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
