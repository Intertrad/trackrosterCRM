import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';
import type { ProspectReservation } from './reservation.types.js';

@Injectable()
export class ReservationRepository {
  constructor(private readonly redisService: RedisService) {}

  async acquire(reservation: ProspectReservation, ttlSeconds: number): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildKey(
      reservation.tenantId,
      reservation.campaignId,
      reservation.campaignProspectId,
    );

    const collisionKey = this.buildCollisionKey(reservation.tenantId, reservation.establishmentId);

    const value = JSON.stringify(reservation);

    /*
     * Both locks must be acquired atomically.
     *
     * KEYS[1] = campaign prospect reservation
     * KEYS[2] = canonical establishment collision lock
     */
    const script = `
      if redis.call('EXISTS', KEYS[1]) == 1 then
        return 0
      end

      if redis.call('EXISTS', KEYS[2]) == 1 then
        return 0
      end

      redis.call(
        'SET',
        KEYS[1],
        ARGV[1],
        'EX',
        ARGV[2]
      )

      redis.call(
        'SET',
        KEYS[2],
        ARGV[1],
        'EX',
        ARGV[2]
      )

      return 1
    `;

    const result = await client.eval(script, {
      keys: [reservationKey, collisionKey],

      arguments: [value, String(ttlSeconds)],
    });

    return Number(result) === 1;
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

  async findCurrentByEstablishment(
    tenantId: string,
    establishmentId: string,
  ): Promise<ProspectReservation | null> {
    const client = this.redisService.getClient();

    const value = await client.get(this.buildCollisionKey(tenantId, establishmentId));

    if (!value) {
      return null;
    }

    return this.parseReservation(value);
  }

  async release(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    establishmentId: string,
    reservationId: string,
  ): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildKey(tenantId, campaignId, campaignProspectId);

    const collisionKey = this.buildCollisionKey(tenantId, establishmentId);

    /*
     * Release both locks atomically.
     *
     * A stale reservation ID must never be able
     * to delete a newer campaign or establishment
     * reservation.
     */
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

      local collisionValue =
        redis.call('GET', KEYS[2])

      if collisionValue then
        local collision =
          cjson.decode(collisionValue)

        if collision.reservationId ~= ARGV[1] then
          return -1
        end
      end

      redis.call('DEL', KEYS[1])

      if collisionValue then
        redis.call('DEL', KEYS[2])
      end

      return 1
    `;

    const result = await client.eval(script, {
      keys: [reservationKey, collisionKey],

      arguments: [reservationId],
    });

    return Number(result) === 1;
  }

  async ttl(tenantId: string, campaignId: string, campaignProspectId: string): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(this.buildKey(tenantId, campaignId, campaignProspectId));
  }

  async collisionTtl(tenantId: string, establishmentId: string): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(this.buildCollisionKey(tenantId, establishmentId));
  }

  buildKey(tenantId: string, campaignId: string, campaignProspectId: string): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  buildCollisionKey(tenantId: string, establishmentId: string): string {
    return ['trackroster', 'collision', tenantId, establishmentId].join(':');
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
      !('establishmentId' in parsed) ||
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
