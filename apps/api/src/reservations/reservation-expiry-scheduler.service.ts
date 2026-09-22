import { Injectable } from '@nestjs/common';

import { RESERVATION_EXPIRY_JOB, buildReservationExpiryJobId } from '@trackroster/jobs';

import { JobProducerService } from '../jobs/job-producer.service.js';
import type { ProspectReservation } from './reservation.types.js';

@Injectable()
export class ReservationExpirySchedulerService {
  constructor(private readonly jobProducerService: JobProducerService) {}

  async schedule(reservation: ProspectReservation, renewal = false): Promise<void> {
    const requestedAt = new Date();

    const expiresAt = new Date(reservation.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error('Reservation expiresAt must be a valid timestamp');
    }

    const baseId = buildReservationExpiryJobId(reservation.reservationId);
    const jobId = renewal ? `${baseId}-${Date.parse(reservation.expiresAt)}` : baseId;

    const delayMs = Math.max(0, expiresAt.getTime() - requestedAt.getTime());

    await this.jobProducerService.enqueue(
      RESERVATION_EXPIRY_JOB,
      {
        jobId,

        tenantId: reservation.tenantId,

        requestedAt: requestedAt.toISOString(),

        reservationId: reservation.reservationId,

        organizationId: reservation.organizationId,

        campaignId: reservation.campaignId,

        campaignProspectId: reservation.campaignProspectId,

        establishmentId: reservation.establishmentId,

        expiresAt: expiresAt.toISOString(),
      },
      {
        delayMs,
      },
    );
  }
}
