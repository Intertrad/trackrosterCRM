import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { CollisionBusinessDecisionService } from '../collisions/collision-business-decision.service.js';
import type {
  ActiveReservationCollisionConflict,
  CollisionDecisionResult,
} from '../collisions/collision.types.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import type { ProspectReservation } from './reservation.types.js';
import { ReservationRepository } from './reservation.repository.js';

export interface ReservationCollisionPipelineInput {
  tenantId: string;
  userId: string;
  campaignId: string;
  campaignProspectId: string;
  assignment: CampaignProspectAssignment;
  establishmentId: string;
}

export interface ReservationCollisionPipelineResult {
  decision: CollisionDecisionResult;
  blockingOrganizationIds: string[];
  reservationConflict: boolean;
  sameOwnerReservation: ProspectReservation | null;
}

/**
 * Single ordering point for reservation-backed collision checks.
 *
 * The caller owns eligibility and the request transaction. This service owns
 * the order after eligibility: active reservation locks first, then the
 * persisted business rules (planned action, recent contact and coordination
 * policy). Reservation acquisition remains a separate Redis operation, but
 * every API claim and read uses this same decision sequence.
 */
@Injectable()
export class ReservationCollisionPipelineService {
  constructor(
    private readonly reservationRepository: ReservationRepository,
    private readonly reservationCoordinationScopeService: ReservationCoordinationScopeService,
    private readonly collisionBusinessDecisionService: CollisionBusinessDecisionService,
  ) {}

  async evaluate(
    input: ReservationCollisionPipelineInput,
  ): Promise<ReservationCollisionPipelineResult> {
    const activeReservation = await this.findExactReservation(input);
    if (activeReservation) {
      const sameOwner =
        activeReservation.userId === input.userId &&
        activeReservation.assignmentId === input.assignment.id;
      if (sameOwner) {
        return {
          decision: {
            decision: 'allow',
            reasonCode: 'NO_COLLISION',
            establishmentId: input.establishmentId,
            conflict: null,
          },
          blockingOrganizationIds: [],
          reservationConflict: false,
          sameOwnerReservation: activeReservation,
        };
      }

      return {
        decision: this.activeReservationDecision(input.establishmentId, activeReservation),
        blockingOrganizationIds: [],
        reservationConflict: true,
        sameOwnerReservation: null,
      };
    }

    const legacyReservation = await this.findLegacyReservation(input);
    if (legacyReservation) {
      return {
        decision: this.activeReservationDecision(input.establishmentId, legacyReservation),
        blockingOrganizationIds: [],
        reservationConflict: true,
        sameOwnerReservation: null,
      };
    }

    let blockingOrganizationIds: string[];
    try {
      const scope = await this.reservationCoordinationScopeService.resolve(
        input.tenantId,
        input.assignment.organizationId,
      );
      blockingOrganizationIds = scope.blockingOrganizationIds;
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }

    const candidates = await this.findScopedReservations(input, blockingOrganizationIds);
    if (candidates.length > 0) {
      return {
        decision: this.activeReservationDecision(input.establishmentId, candidates[0]!),
        blockingOrganizationIds,
        reservationConflict: true,
        sameOwnerReservation: null,
      };
    }

    return {
      decision: await this.collisionBusinessDecisionService.evaluate({
        tenantId: input.tenantId,
        userId: input.userId,
        campaignId: input.campaignId,
        campaignProspectId: input.campaignProspectId,
        establishmentId: input.establishmentId,
        targetOrganizationId: input.assignment.organizationId,
      }),
      blockingOrganizationIds,
      reservationConflict: false,
      sameOwnerReservation: null,
    };
  }

  private async findExactReservation(
    input: ReservationCollisionPipelineInput,
  ): Promise<ProspectReservation | null> {
    try {
      return await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }
  }

  private async findLegacyReservation(
    input: ReservationCollisionPipelineInput,
  ): Promise<ProspectReservation | null> {
    try {
      return await this.reservationRepository.findCurrentByEstablishment(
        input.tenantId,
        input.establishmentId,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }
  }

  private async findScopedReservations(
    input: ReservationCollisionPipelineInput,
    organizationIds: string[],
  ): Promise<ProspectReservation[]> {
    try {
      return await this.reservationRepository.findCurrentCandidatesByOrganizations(
        input.tenantId,
        input.establishmentId,
        organizationIds,
      );
    } catch {
      throw new ServiceUnavailableException('Collision service is unavailable');
    }
  }

  private activeReservationDecision(
    establishmentId: string,
    reservation: ProspectReservation,
  ): CollisionDecisionResult {
    const conflict: ActiveReservationCollisionConflict = {
      reservationId: reservation.reservationId,
      campaignId: reservation.campaignId,
      campaignProspectId: reservation.campaignProspectId,
      assignmentId: reservation.assignmentId,
      teamId: reservation.teamId,
      userId: reservation.userId,
      acquiredAt: reservation.acquiredAt,
      expiresAt: reservation.expiresAt,
    };
    return {
      decision: 'block',
      reasonCode: 'ACTIVE_RESERVATION',
      establishmentId,
      conflict,
    };
  }
}
