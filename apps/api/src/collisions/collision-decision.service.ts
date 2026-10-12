import { Injectable } from '@nestjs/common';

import { ReservationService } from '../reservations/reservation.service.js';
import { ReservationCollisionPipelineService } from '../reservations/reservation-collision-pipeline.service.js';
import type { CollisionDecisionResult } from './collision.types.js';

export interface EvaluateCollisionInput {
  tenantId: string;
  userId: string;
  campaignId: string;
  campaignProspectId: string;

  /** GET status checks may be read by a manager for a delegated team row. */
  mode?: 'mutate' | 'read';
}

@Injectable()
export class CollisionDecisionService {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly reservationCollisionPipelineService: ReservationCollisionPipelineService,
  ) {}

  async evaluate(input: EvaluateCollisionInput): Promise<CollisionDecisionResult> {
    const eligibilityInput = {
      tenantId: input.tenantId,
      userId: input.userId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
    };
    const { assignment, establishmentId } =
      input.mode === 'read'
        ? await this.reservationService.requireReservationReadEligibility(eligibilityInput)
        : await this.reservationService.requireReservationEligibility(eligibilityInput);

    const result = await this.reservationCollisionPipelineService.evaluate({
      tenantId: input.tenantId,
      userId: input.userId,
      campaignId: input.campaignId,
      campaignProspectId: input.campaignProspectId,
      assignment,
      establishmentId,
    });
    return result.decision;
  }
}
