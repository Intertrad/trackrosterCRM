import { Injectable, Logger } from '@nestjs/common';

import type { ReservationExpiryJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';
import { ReservationExpiryRepository } from '../repositories/reservation-expiry.repository.js';

@Injectable()
export class ReservationExpiryProcessor {
  private readonly logger = new Logger(ReservationExpiryProcessor.name);

  constructor(private readonly repository: ReservationExpiryRepository) {}

  async process(
    data: ReservationExpiryJobData,

    context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    const expiresAt = this.requireValidPayload(data);

    /*
     * BullMQ should not normally deliver early,
     * but expiry correctness must never depend on
     * scheduler timing.
     *
     * Redis TTL remains authoritative.
     */
    if (Date.now() < expiresAt.getTime()) {
      return {
        status: 'noop',

        reason: 'reservation-not-expired',
      };
    }

    const current = await this.repository.findCurrent(
      data.tenantId,

      data.campaignId,

      data.campaignProspectId,
    );

    /*
     * This is expected in normal operation because
     * Redis TTL may already have removed the key
     * before BullMQ executes the secondary job.
     */
    if (!current) {
      return {
        status: 'noop',

        reason: 'reservation-already-expired',
      };
    }

    /*
     * Never let an old delayed job remove a newer
     * reservation generation.
     */
    if (current.reservationId !== data.reservationId) {
      return {
        status: 'noop',

        reason: 'reservation-replaced',
      };
    }

    if (
      current.organizationId !== data.organizationId ||
      current.establishmentId !== data.establishmentId
    ) {
      return {
        status: 'noop',

        reason: 'reservation-scope-changed',
      };
    }

    if (current.expiresAt !== data.expiresAt) {
      return {
        status: 'noop',

        reason: 'reservation-expiry-changed',
      };
    }

    const released = await this.repository.releaseIfMatch({
      tenantId: data.tenantId,

      reservationId: data.reservationId,

      organizationId: data.organizationId,

      campaignId: data.campaignId,

      campaignProspectId: data.campaignProspectId,

      establishmentId: data.establishmentId,

      expiresAt: data.expiresAt,
    });

    /*
     * Reservation may have disappeared/replaced
     * between findCurrent() and the Lua script.
     *
     * That is a normal idempotent no-op.
     */
    if (!released) {
      return {
        status: 'noop',

        reason: 'reservation-changed',
      };
    }

    this.logger.log(
      [
        'Expired reservation cleanup processed',

        `jobId=${context.jobId}`,

        `reservationId=${data.reservationId}`,

        `tenantId=${data.tenantId}`,

        `attempt=${context.attempt}/${context.maxAttempts}`,
      ].join(' '),
    );

    return {
      status: 'processed',
    };
  }

  private requireValidPayload(data: ReservationExpiryJobData): Date {
    const requiredValues = [
      ['jobId', data.jobId],

      ['tenantId', data.tenantId],

      ['reservationId', data.reservationId],

      ['organizationId', data.organizationId],

      ['campaignId', data.campaignId],

      ['campaignProspectId', data.campaignProspectId],

      ['establishmentId', data.establishmentId],
    ] as const;

    for (const [name, value] of requiredValues) {
      if (typeof value !== 'string' || value.length === 0) {
        throw new PermanentJobError(`Invalid job payload: ${name} is required`);
      }
    }

    if (typeof data.requestedAt !== 'string' || Number.isNaN(Date.parse(data.requestedAt))) {
      throw new PermanentJobError('Invalid job payload: requestedAt must be a valid timestamp');
    }

    if (typeof data.expiresAt !== 'string') {
      throw new PermanentJobError('Invalid job payload: expiresAt must be a valid timestamp');
    }

    const expiresAt = new Date(data.expiresAt);

    if (Number.isNaN(expiresAt.getTime())) {
      throw new PermanentJobError('Invalid job payload: expiresAt must be a valid timestamp');
    }

    return expiresAt;
  }
}
