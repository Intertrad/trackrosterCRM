import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { DATABASE } from '../database/database.constants.js';
import type {
  ProspectActivity,
  ProspectActivityType,
} from '../database/schema/prospect-activities.js';
import type { Database } from '../database/database.types.js';
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
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly prospectActivityRepository: ProspectActivityRepository,

    private readonly assignmentRepository: CampaignProspectAssignmentRepository,

    private readonly reservationRepository: ReservationRepository,

    private readonly reservationService: ReservationService,
  ) {}

  async record(input: RecordProspectActivityInput): Promise<ProspectActivity> {
    /*
     * Resolve the authoritative operational
     * assignment and canonical establishment.
     */
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.userId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    /*
     * An ordinary prospector may record activity
     * only while owning the active Redis reservation
     * for this exact prospect.
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
     * Protect against stale or corrupted reservation
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
     * Reject a reservation issued under an
     * assignment that was already stale when
     * eligibility was resolved.
     */
    if (reservation.assignmentId !== assignment.id) {
      throw new ConflictException('Reservation does not match current assignment');
    }

    try {
      return await this.database.transaction(async (transaction) => {
        /*
         * Final TOCTOU boundary.
         *
         * Eligibility and Redis validation above are
         * optimistic reads.
         *
         * Lock the authoritative current assignment
         * inside the SAME PostgreSQL transaction
         * that records the immutable activity.
         *
         * If reassignment/unassignment already won,
         * the locked current assignment will either:
         *
         * - be missing, or
         * - have a different assignment ID.
         *
         * If reassignment begins after this lock, its
         * UPDATE must wait until this transaction
         * finishes.
         */
        const lockedAssignment = await this.assignmentRepository.findCurrentForUpdate(
          input.tenantId,

          input.campaignId,

          input.campaignProspectId,

          transaction,
        );

        if (!lockedAssignment || lockedAssignment.id !== assignment.id) {
          throw new ConflictException('Campaign prospect changed during activity recording');
        }

        /*
         * The reservation was issued for the same
         * assignment we now hold locked.
         */
        if (reservation.assignmentId !== lockedAssignment.id) {
          throw new ConflictException('Reservation does not match current assignment');
        }

        return this.prospectActivityRepository.create(
          {
            tenantId: input.tenantId,

            campaignId: input.campaignId,

            campaignProspectId: input.campaignProspectId,

            establishmentId,

            assignmentId: lockedAssignment.id,

            userId: input.userId,

            reservationId: reservation.reservationId,

            type: input.type,
          },

          transaction,
        );
      });
    } catch (error: unknown) {
      /*
       * Assignment movement is an expected domain
       * conflict and must not be disguised as an
       * infrastructure outage.
       */
      if (error instanceof ConflictException) {
        throw error;
      }

      throw new ServiceUnavailableException('Activity service is unavailable');
    }
  }
}
