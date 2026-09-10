import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import { CollisionBusinessDecisionService } from './collision-business-decision.service.js';
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

    private readonly reservationCoordinationScopeService: ReservationCoordinationScopeService,

    private readonly collisionBusinessDecisionService: CollisionBusinessDecisionService,
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,
        userId: input.userId,
        campaignId: input.campaignId,
        campaignProspectId: input.campaignProspectId,
      });

    /*
     * Priority 1A:
     * exact campaign-prospect reservation.
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
     * legacy tenant-wide reservation.
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
     * Priority 1C:
     * organization-scoped reservations.
     */
    let blockingOrganizationIds: string[];

    try {
      const scope = await this.reservationCoordinationScopeService.resolve(
        input.tenantId,
        assignment.organizationId,
      );

      blockingOrganizationIds = scope.blockingOrganizationIds;
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

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
     * All persisted business collisions now flow
     * through one canonical evaluator.
     */
    return this.collisionBusinessDecisionService.evaluate({
      tenantId: input.tenantId,
      userId: input.userId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
      establishmentId,
      targetOrganizationId: assignment.organizationId,
    });
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
