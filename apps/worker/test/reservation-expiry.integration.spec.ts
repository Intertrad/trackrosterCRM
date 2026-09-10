import { randomUUID } from 'node:crypto';

import { Redis } from 'ioredis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { ReservationExpiryJobData } from '@trackroster/jobs';

import { ReservationExpiryProcessor } from '../src/jobs/processors/reservation-expiry.processor.js';
import {
  ReservationExpiryRepository,
  type StoredReservation,
} from '../src/jobs/repositories/reservation-expiry.repository.js';
import type { ReservationRedisService } from '../src/reservations/reservation-redis.service.js';

describe('Reservation expiry Redis integration', () => {
  let redis: Redis;
  let repository: ReservationExpiryRepository;
  let processor: ReservationExpiryProcessor;

  const keysToDelete = new Set<string>();

  beforeAll(async () => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

    redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    await redis.connect();
    await redis.ping();

    const redisService = {
      getClient: () => redis,
    } as unknown as ReservationRedisService;

    repository = new ReservationExpiryRepository(redisService);

    processor = new ReservationExpiryProcessor(repository);
  }, 15_000);

  afterEach(async () => {
    if (keysToDelete.size === 0) {
      return;
    }

    await redis.del(...keysToDelete);

    keysToDelete.clear();
  });

  afterAll(async () => {
    if (!redis || redis.status === 'end') {
      return;
    }

    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  });

  function buildReservationKey(
    tenantId: string,
    campaignId: string,
    campaignProspectId: string,
  ): string {
    return ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':');
  }

  function buildCollisionKey(
    tenantId: string,
    organizationId: string,
    establishmentId: string,
  ): string {
    return ['trackroster', 'collision', tenantId, organizationId, establishmentId].join(':');
  }

  function createFixture(reservationId = randomUUID()): {
    reservation: StoredReservation;
    data: ReservationExpiryJobData;
    reservationKey: string;
    collisionKey: string;
  } {
    const tenantId = randomUUID();
    const organizationId = randomUUID();
    const campaignId = randomUUID();
    const campaignProspectId = randomUUID();
    const establishmentId = randomUUID();

    /*
     * Deliberately in the past so the processor
     * reaches Redis cleanup immediately.
     *
     * The test writes Redis state manually without
     * EX because it is testing secondary cleanup,
     * not Redis TTL itself.
     */
    const expiresAt = '2020-01-01T00:20:00.000Z';

    const reservation: StoredReservation = {
      reservationId,
      tenantId,
      organizationId,
      campaignId,
      campaignProspectId,
      establishmentId,
      assignmentId: randomUUID(),
      teamId: randomUUID(),
      userId: randomUUID(),
      acquiredAt: '2020-01-01T00:00:00.000Z',
      expiresAt,
    };

    const data: ReservationExpiryJobData = {
      jobId: randomUUID(),
      tenantId,
      requestedAt: '2020-01-01T00:00:00.000Z',
      reservationId,
      organizationId,
      campaignId,
      campaignProspectId,
      establishmentId,
      expiresAt,
    };

    const reservationKey = buildReservationKey(tenantId, campaignId, campaignProspectId);

    const collisionKey = buildCollisionKey(tenantId, organizationId, establishmentId);

    keysToDelete.add(reservationKey);
    keysToDelete.add(collisionKey);

    return {
      reservation,
      data,
      reservationKey,
      collisionKey,
    };
  }

  it('deletes the exact expired reservation and its organization collision lock', async () => {
    const fixture = createFixture();

    const serialized = JSON.stringify(fixture.reservation);

    await redis.set(fixture.reservationKey, serialized);

    await redis.set(fixture.collisionKey, serialized);

    const result = await processor.process(fixture.data, {
      jobId: fixture.data.jobId,
      attempt: 1,
      maxAttempts: 3,
    });

    expect(result).toEqual({
      status: 'processed',
    });

    expect(await redis.get(fixture.reservationKey)).toBeNull();

    expect(await redis.get(fixture.collisionKey)).toBeNull();
  });

  it('does not delete a newer reservation generation when an old expiry job arrives', async () => {
    const oldReservationId = randomUUID();

    const fixture = createFixture(oldReservationId);

    const newerReservation: StoredReservation = {
      ...fixture.reservation,

      reservationId: randomUUID(),

      acquiredAt: '2020-01-01T01:00:00.000Z',

      expiresAt: '2030-01-01T00:20:00.000Z',
    };

    const serialized = JSON.stringify(newerReservation);

    await redis.set(fixture.reservationKey, serialized);

    await redis.set(fixture.collisionKey, serialized);

    const result = await processor.process(fixture.data, {
      jobId: fixture.data.jobId,
      attempt: 1,
      maxAttempts: 3,
    });

    expect(result).toEqual({
      status: 'noop',
      reason: 'reservation-replaced',
    });

    expect(await redis.get(fixture.reservationKey)).toBe(serialized);

    expect(await redis.get(fixture.collisionKey)).toBe(serialized);
  });

  it('does not delete anything when the collision lock belongs to another reservation', async () => {
    const fixture = createFixture();

    const reservationValue = JSON.stringify(fixture.reservation);

    const competingCollision: StoredReservation = {
      ...fixture.reservation,

      reservationId: randomUUID(),
    };

    const collisionValue = JSON.stringify(competingCollision);

    await redis.set(fixture.reservationKey, reservationValue);

    await redis.set(fixture.collisionKey, collisionValue);

    const result = await processor.process(fixture.data, {
      jobId: fixture.data.jobId,
      attempt: 1,
      maxAttempts: 3,
    });

    expect(result).toEqual({
      status: 'noop',
      reason: 'reservation-changed',
    });

    expect(await redis.get(fixture.reservationKey)).toBe(reservationValue);

    expect(await redis.get(fixture.collisionKey)).toBe(collisionValue);
  });

  it('noops cleanly when Redis TTL already removed the reservation', async () => {
    const fixture = createFixture();

    const result = await processor.process(fixture.data, {
      jobId: fixture.data.jobId,
      attempt: 1,
      maxAttempts: 3,
    });

    expect(result).toEqual({
      status: 'noop',
      reason: 'reservation-already-expired',
    });
  });
});
