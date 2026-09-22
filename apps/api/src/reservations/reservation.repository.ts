import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';
import type { ProspectReservation } from './reservation.types.js';

@Injectable()
export class ReservationRepository {
  constructor(private readonly redisService: RedisService) {}

  /*
   * Legacy tenant-wide acquisition.
   *
   * Keep this until ReservationService moves to
   * acquireWithinOrganizationScope() in TR-017-F3.
   */
  async acquire(reservation: ProspectReservation, ttlSeconds: number): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildKey(
      reservation.tenantId,
      reservation.campaignId,
      reservation.campaignProspectId,
    );

    const collisionKey = this.buildCollisionKey(reservation.tenantId, reservation.establishmentId);

    const value = JSON.stringify(reservation);

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

  /*
   * TR-017 organization-aware acquisition.
   *
   * KEYS[1]
   *   Exact campaign-prospect reservation.
   *
   * KEYS[2]
   *   The target organization's establishment lock.
   *
   * KEYS[3...N]
   *   Establishment locks belonging to organizations
   *   whose policies conflict with the target.
   *
   * The Lua script checks every key atomically but
   * writes only:
   *
   * - the exact reservation key
   * - the target organization's collision key
   *
   * This is what allows INDEPENDENT organizations
   * to hold simultaneous reservations.
   */
  async acquireWithinOrganizationScope(
    reservation: ProspectReservation,
    blockingOrganizationIds: string[],
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = this.redisService.getClient();

    const uniqueBlockingOrganizationIds = [...new Set(blockingOrganizationIds)];

    if (!uniqueBlockingOrganizationIds.includes(reservation.organizationId)) {
      throw new Error('Reservation scope must include the target organization');
    }

    const reservationKey = this.buildKey(
      reservation.tenantId,
      reservation.campaignId,
      reservation.campaignProspectId,
    );

    const targetCollisionKey = this.buildOrganizationCollisionKey(
      reservation.tenantId,
      reservation.organizationId,
      reservation.establishmentId,
    );

    /*
     * Target must remain KEYS[2] because that is
     * the organization lock we create on success.
     */
    const otherBlockingCollisionKeys = uniqueBlockingOrganizationIds
      .filter((organizationId) => organizationId !== reservation.organizationId)
      .sort()
      .map((organizationId) =>
        this.buildOrganizationCollisionKey(
          reservation.tenantId,
          organizationId,
          reservation.establishmentId,
        ),
      );

    const keys = [
      reservationKey,
      targetCollisionKey,
      ...otherBlockingCollisionKeys,
      this.buildCollisionKey(reservation.tenantId, reservation.establishmentId),
    ];

    const value = JSON.stringify(reservation);

    const script = `
      local now=redis.call('TIME')
      local nowMillis=tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000)
      if tonumber(ARGV[3])<=nowMillis then return 0 end
      if redis.call('EXISTS', KEYS[1]) == 1 then
        return 0
      end

      for index = 2, #KEYS do
        if redis.call('EXISTS', KEYS[index]) == 1 then
          return 0
        end
      end

      redis.call(
        'SET',
        KEYS[1],
        ARGV[1],
        'PXAT',
        ARGV[3]
      )

      redis.call(
        'SET',
        KEYS[2],
        ARGV[1],
        'PXAT',
        ARGV[3]
      )

      return 1
    `;

    const result = await client.eval(script, {
      keys,

      arguments: [value, String(ttlSeconds), String(Date.parse(reservation.expiresAt))],
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

  /*
   * Legacy tenant-wide lookup.
   *
   * Keep until collision/reservation services move
   * to organization-aware candidate lookup.
   */
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

  async findCurrentByOrganizationEstablishment(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): Promise<ProspectReservation | null> {
    const client = this.redisService.getClient();

    const value = await client.get(
      this.buildOrganizationCollisionKey(tenantId, organizationId, establishmentId),
    );

    if (!value) {
      return null;
    }

    return this.parseReservation(value);
  }

  /*
   * Returns every currently reserved organization
   * lock relevant to a coordination scope.
   *
   * Organization IDs are deduplicated so the same
   * Redis key is never fetched twice.
   */
  async findCurrentCandidatesByOrganizations(
    tenantId: string,
    establishmentId: string,
    organizationIds: string[],
  ): Promise<ProspectReservation[]> {
    const client = this.redisService.getClient();

    const uniqueOrganizationIds = [...new Set(organizationIds)];

    if (uniqueOrganizationIds.length === 0) {
      return [];
    }

    const keys = uniqueOrganizationIds.map((organizationId) =>
      this.buildOrganizationCollisionKey(tenantId, organizationId, establishmentId),
    );

    const values = await client.mGet(keys);

    return values
      .filter((value): value is string => value !== null)
      .map((value) => this.parseReservation(value));
  }

  /*
   * Legacy tenant-wide release.
   *
   * Keep until ReservationService switches to
   * releaseOrganizationScoped().
   */
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

  /*
   * Organization-aware release.
   *
   * Only the exact reservation and the target
   * organization's collision lock are deleted.
   *
   * Locks belonging to other organizations were
   * only checked during acquisition and are never
   * owned by this reservation.
   */
  async releaseOrganizationScoped(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
    organizationId: string,
    establishmentId: string,
    reservationId: string,
  ): Promise<boolean> {
    const client = this.redisService.getClient();

    const reservationKey = this.buildKey(tenantId, campaignId, campaignProspectId);

    const collisionKey = this.buildOrganizationCollisionKey(
      tenantId,
      organizationId,
      establishmentId,
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

      arguments: [reservationId, organizationId],
    });

    return Number(result) === 1;
  }

  async renewOrganizationScoped(
    current: ProspectReservation,
    next: ProspectReservation,
    blockingOrganizationIds: string[],
  ): Promise<boolean> {
    const keys = [
      this.buildKey(current.tenantId, current.campaignId, current.campaignProspectId),
      this.buildOrganizationCollisionKey(
        current.tenantId,
        current.organizationId,
        current.establishmentId,
      ),
      this.buildCollisionKey(current.tenantId, current.establishmentId),
      ...[...new Set(blockingOrganizationIds)]
        .filter((id) => id !== current.organizationId)
        .sort()
        .map((id) =>
          this.buildOrganizationCollisionKey(current.tenantId, id, current.establishmentId),
        ),
    ];
    const result = await this.redisService.getClient().eval(
      `
      local exact=redis.call('GET',KEYS[1])
      local own=redis.call('GET',KEYS[2])
      if not exact or not own then return 0 end
      local lease=cjson.decode(exact)
      local collision=cjson.decode(own)
      if lease.reservationId~=ARGV[1] or collision.reservationId~=ARGV[1] or lease.userId~=ARGV[2] or lease.expiresAt~=ARGV[3] then return 0 end
      for i=3,#KEYS do
        local other=redis.call('GET',KEYS[i])
        if other and cjson.decode(other).reservationId~=ARGV[1] then return 0 end
      end
      local now=redis.call('TIME')
      local nowMillis=tonumber(now[1])*1000+math.floor(tonumber(now[2])/1000)
      if tonumber(ARGV[6])<=nowMillis or tonumber(ARGV[5])<=tonumber(ARGV[6]) then return 0 end
      redis.call('SET',KEYS[1],ARGV[4],'PXAT',ARGV[5])
      redis.call('SET',KEYS[2],ARGV[4],'PXAT',ARGV[5])
      return 1
    `,
      {
        keys,
        arguments: [
          current.reservationId,
          current.userId,
          current.expiresAt,
          JSON.stringify(next),
          String(Date.parse(next.expiresAt)),
          String(Date.parse(current.expiresAt)),
        ],
      },
    );
    return Number(result) === 1;
  }

  async ttl(tenantId: string, campaignId: string, campaignProspectId: string): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(this.buildKey(tenantId, campaignId, campaignProspectId));
  }

  /*
   * Legacy collision TTL.
   */
  async collisionTtl(tenantId: string, establishmentId: string): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(this.buildCollisionKey(tenantId, establishmentId));
  }

  async organizationCollisionTtl(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): Promise<number> {
    const client = this.redisService.getClient();

    return client.ttl(
      this.buildOrganizationCollisionKey(tenantId, organizationId, establishmentId),
    );
  }

  buildKey(tenantId: string, campaignId: string, campaignProspectId: string): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  /*
   * Legacy TR-016 tenant-wide collision key.
   */
  buildCollisionKey(tenantId: string, establishmentId: string): string {
    return ['trackroster', 'collision', tenantId, establishmentId].join(':');
  }

  /*
   * TR-017 organization-aware collision key.
   */
  buildOrganizationCollisionKey(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): string {
    return ['trackroster', 'collision', tenantId, organizationId, establishmentId].join(':');
  }

  private parseReservation(value: string): ProspectReservation {
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

    return parsed as ProspectReservation;
  }
}
