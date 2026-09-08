import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';
import type { ProspectReservation } from './reservation.types.js';

@Injectable()
export class ReservationRepository {
  constructor(private readonly redisService: RedisService) {}

  async acquire(reservation: ProspectReservation, ttlSeconds: number): Promise<boolean> {
    const client = this.redisService.getClient();

    const result = await client.set(
      this.buildKey(reservation.tenantId, reservation.campaignId, reservation.campaignProspectId),
      JSON.stringify(reservation),
      {
        NX: true,
        EX: ttlSeconds,
      },
    );

    return result === 'OK';
  }

  async findCurrent(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): Promise<ProspectReservation | null> {
    const client = this.redisService.getClient();

    const value = await client.get(this.buildKey(tenantId, campaignId, campaignProspectId));

    if (!value) {
      return null;
    }

    return this.parseReservation(value);
  }

  async release(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    reservationId: string,
  ): Promise<boolean> {
    const client = this.redisService.getClient();

    const key = this.buildKey(tenantId, campaignId, campaignProspectId);

    /*
     * Compare-and-delete.
     *
     * Never DELETE the key blindly because an
     * old client could otherwise delete a newer
     * reservation created after its own expired.
     */
    const script = `
      local value = redis.call('GET', KEYS[1])

      if not value then
        return 0
      end

      local reservation = cjson.decode(value)

      if reservation.reservationId ~= ARGV[1] then
        return 0
      end

      return redis.call('DEL', KEYS[1])
    `;

    const result = await client.eval(script, {
      keys: [key],

      arguments: [reservationId],
    });

    return Number(result) === 1;
  }

  async ttl(tenantId: string, campaignId: string, campaignProspectId: string): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(this.buildKey(tenantId, campaignId, campaignProspectId));
  }

  buildKey(tenantId: string, campaignId: string, campaignProspectId: string): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  private parseReservation(value: string): ProspectReservation {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('reservationId' in parsed) ||
      !('tenantId' in parsed) ||
      !('campaignId' in parsed) ||
      !('campaignProspectId' in parsed) ||
      !('assignmentId' in parsed) ||
      !('teamId' in parsed) ||
      !('userId' in parsed) ||
      !('acquiredAt' in parsed) ||
      !('expiresAt' in parsed)
    ) {
      throw new Error('Invalid reservation stored in Redis');
    }

    return parsed as ProspectReservation;
  }
}
