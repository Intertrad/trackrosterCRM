import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import type {
  ProspectActivity,
  ProspectActivityType,
} from '../database/schema/prospect-activities.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { ProspectActivityRepository } from './prospect-activity.repository.js';

export interface RecordProspectActivityInput {
  tenantId: string;
  userId: string;

  campaignId: string;
  campaignProspectId: string;

  type: ProspectActivityType;
}

@Injectable()
export class ProspectActivityService {
  constructor(
    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly reservationRepository: ReservationRepository,

    private readonly reservationService: ReservationService,
  ) {}

  async record(input: RecordProspectActivityInput): Promise<ProspectActivity> {
    /*
     * Reuse the exact same eligibility rules as
     * reservation acquisition.
     *
     * This gives us:
     * - current assignment
     * - canonical establishment ID
     */
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.userId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    /*
     * An ordinary prospector may only record
     * activity while owning the active
     * reservation for this exact prospect.
     */
    let reservation;

    try {
      reservation = await this.reservationRepository.findCurrent(
        input.tenantId,
        input.campaignId,
        input.campaignProspectId,
      );
    } catch {
      throw new ServiceUnavailableException('Reservation service is unavailable');
    }

    if (!reservation) {
      throw new ConflictException('Active reservation required');
    }

    if (reservation.userId !== input.userId) {
      throw new ForbiddenException('Reservation belongs to another user');
    }

    /*
     * Protect against stale/corrupted reservation
     * context.
     */
    if (
      reservation.campaignId !== input.campaignId ||
      reservation.campaignProspectId !== input.campaignProspectId ||
      reservation.establishmentId !== establishmentId
    ) {
      throw new ConflictException('Reservation does not match campaign prospect');
    }

    /*
     * If a manager reassigned the prospect after
     * this Redis reservation was created, that
     * stale reservation may no longer authorize
     * activity.
     */
    if (reservation.assignmentId !== assignment.id) {
      throw new ConflictException('Reservation does not match current assignment');
    }

    try {
      return await this.prospectActivityRepository.create({
        tenantId: input.tenantId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        establishmentId,

        assignmentId: assignment.id,

        userId: input.userId,

        reservationId: reservation.reservationId,

        type: input.type,
      });
    } catch {
      throw new ServiceUnavailableException('Activity service is unavailable');
    }
  }
}
