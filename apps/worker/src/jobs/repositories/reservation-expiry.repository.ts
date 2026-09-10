import { Injectable } from '@nestjs/common';

import { ReservationRedisService } from '../../reservations/reservation-redis.service.js';

export interface StoredReservation {
  reservationId: string;

  tenantId: string;

  organizationId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  teamId: string;

  userId: string;

  acquiredAt: string;

  expiresAt: string;
}

export interface ReleaseExpiredReservationInput {
  tenantId: string;

  reservationId: string;

  organizationId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  expiresAt: string;
}

@Injectable()
export class ReservationExpiryRepository {
  constructor(private readonly redisService: ReservationRedisService) {}

  async findCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<StoredReservation | null> {
    const client = this.redisService.getClient();

    const value = await client.get(
      this.buildReservationKey(tenantId, campaignId, campaignProspectId),
    );

    if (!value) {
      return null;
    }

    return this.parseReservation(value);
  }

  /*
   * Atomically release only this exact reservation
   * generation.
   *
   * A delayed job belonging to an older reservation
   * can never remove a newer reservation because
   * reservationId, organizationId,
   * establishmentId and expiresAt must all match.
   */
  async releaseIfMatch(input: ReleaseExpiredReservationInput): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildReservationKey(
      input.tenantId,
      input.campaignId,
      input.campaignProspectId,
    );

    const collisionKey = this.buildOrganizationCollisionKey(
      input.tenantId,
      input.organizationId,
      input.establishmentId,
    );

    const script = `
      local reservationValue =
        redis.call('GET', KEYS[1])

      if not reservationValue then
        return 0
      end

      local reservation =
        cjson.decode(reservationValue)

      if reservation.reservationId ~= ARGV[1] then
        return 0
      end

      if reservation.organizationId ~= ARGV[2] then
        return 0
      end

      if reservation.establishmentId ~= ARGV[3] then
        return 0
      end

      if reservation.expiresAt ~= ARGV[4] then
        return 0
      end

      local collisionValue =
        redis.call('GET', KEYS[2])

      if collisionValue then
        local collision =
          cjson.decode(collisionValue)

        if collision.reservationId ~= ARGV[1] then
          return -1
        end
      end

      redis.call(
        'DEL',
        KEYS[1]
      )

      if collisionValue then
        redis.call(
          'DEL',
          KEYS[2]
        )
      end

      return 1
    `;

    const result = await client.eval(
      script,
      2,
      reservationKey,
      collisionKey,
      input.reservationId,
      input.organizationId,
      input.establishmentId,
      input.expiresAt,
    );

    return Number(result) === 1;
  }

  private buildReservationKey(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  private buildOrganizationCollisionKey(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): string {
    return ['trackroster', 'collision', tenantId, organizationId, establishmentId].join(':');
  }

  private parseReservation(value: string): StoredReservation {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('reservationId' in parsed) ||
      !('tenantId' in parsed) ||
      !('organizationId' in parsed) ||
      !('campaignId' in parsed) ||
      !('campaignProspectId' in parsed) ||
      !('establishmentId' in parsed) ||
      !('assignmentId' in parsed) ||
      !('teamId' in parsed) ||
      !('userId' in parsed) ||
      !('acquiredAt' in parsed) ||
      !('expiresAt' in parsed)
    ) {
      throw new Error('Invalid reservation stored in Redis');
    }

    return parsed as StoredReservation;
  }
}
