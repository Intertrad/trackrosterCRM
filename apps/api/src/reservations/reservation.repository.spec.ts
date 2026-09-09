import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisService } from '../redis/redis.service.js';
import { ReservationRepository } from './reservation.repository.js';
import type { ProspectReservation } from './reservation.types.js';

describe('ReservationRepository', () => {
  let client: {
    eval: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    mGet: ReturnType<typeof vi.fn>;
    ttl: ReturnType<typeof vi.fn>;
  };

  let repository: ReservationRepository;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationAId = '22222222-2222-4222-8222-222222222222';

  const organizationBId = '33333333-3333-4333-8333-333333333333';

  const organizationCId = '44444444-4444-4444-8444-444444444444';

  const campaignId = '55555555-5555-4555-8555-555555555555';

  const campaignProspectId = '66666666-6666-4666-8666-666666666666';

  const establishmentId = '77777777-7777-4777-8777-777777777777';

  const reservation: ProspectReservation = {
    reservationId: '88888888-8888-4888-8888-888888888888',

    tenantId,

    organizationId: organizationAId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId: '99999999-9999-4999-8999-999999999999',

    teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    acquiredAt: '2026-09-09T08:00:00.000Z',

    expiresAt: '2026-09-09T08:20:00.000Z',
  };

  beforeEach(() => {
    client = {
      eval: vi.fn().mockResolvedValue(1),

      get: vi.fn().mockResolvedValue(null),

      mGet: vi.fn().mockResolvedValue([]),

      ttl: vi.fn().mockResolvedValue(1200),
    };

    const redisService = {
      getClient: () => client,
    };

    repository = new ReservationRepository(redisService as unknown as RedisService);
  });

  it('builds an exact reservation key', () => {
    expect(repository.buildKey(tenantId, campaignId, campaignProspectId)).toBe(
      ['trackroster', 'reservation', tenantId, campaignId, campaignProspectId].join(':'),
    );
  });

  it('builds the legacy tenant-wide collision key', () => {
    expect(repository.buildCollisionKey(tenantId, establishmentId)).toBe(
      ['trackroster', 'collision', tenantId, establishmentId].join(':'),
    );
  });

  it('builds an organization-scoped collision key', () => {
    expect(
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    ).toBe(['trackroster', 'collision', tenantId, organizationAId, establishmentId].join(':'));
  });

  it('acquires against the target and every blocking organization atomically', async () => {
    await expect(
      repository.acquireWithinOrganizationScope(
        reservation,
        [organizationAId, organizationBId, organizationCId],
        1200,
      ),
    ).resolves.toBe(true);

    expect(client.eval).toHaveBeenCalledTimes(1);

    const [script, options] = client.eval.mock.calls[0] as [
      string,
      {
        keys: string[];
        arguments: string[];
      },
    ];

    expect(script).toContain('for index = 2, #KEYS do');

    expect(options.keys[0]).toBe(repository.buildKey(tenantId, campaignId, campaignProspectId));

    /*
     * KEYS[2] must always be the target
     * organization's collision key because
     * that is the only organization-scoped
     * collision key written on success.
     */
    expect(options.keys[1]).toBe(
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    );

    expect(options.keys).toContain(
      repository.buildOrganizationCollisionKey(tenantId, organizationBId, establishmentId),
    );

    expect(options.keys).toContain(
      repository.buildOrganizationCollisionKey(tenantId, organizationCId, establishmentId),
    );

    expect(options.arguments).toEqual([JSON.stringify(reservation), '1200']);
  });

  it('writes only the target organization lock while checking the whole coordination scope', async () => {
    await repository.acquireWithinOrganizationScope(
      reservation,
      [organizationAId, organizationBId],
      1200,
    );

    const [script] = client.eval.mock.calls[0] as [
      string,
      {
        keys: string[];
        arguments: string[];
      },
    ];

    /*
     * The Lua script checks KEYS[2..N] but writes
     * only KEYS[1] and KEYS[2].
     */
    expect(script).toContain("redis.call(\n        'SET',\n        KEYS[1]");

    expect(script).toContain("redis.call(\n        'SET',\n        KEYS[2]");

    expect(script).not.toContain("redis.call('SET', KEYS[index]");
  });

  it('deduplicates blocking organizations', async () => {
    await repository.acquireWithinOrganizationScope(
      reservation,
      [organizationAId, organizationAId, organizationBId, organizationBId],
      1200,
    );

    const options = client.eval.mock.calls[0]?.[1] as {
      keys: string[];
    };

    /*
     * Exact reservation key
     * +
     * organization A collision key
     * +
     * organization B collision key
     */
    expect(options.keys).toHaveLength(3);

    expect(new Set(options.keys).size).toBe(options.keys.length);
  });

  it('keeps the target organization collision key in position two even when scope order differs', async () => {
    await repository.acquireWithinOrganizationScope(
      reservation,
      [organizationCId, organizationBId, organizationAId],
      1200,
    );

    const options = client.eval.mock.calls[0]?.[1] as {
      keys: string[];
    };

    expect(options.keys[1]).toBe(
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    );
  });

  it('rejects an acquisition scope that omits the target organization', async () => {
    await expect(
      repository.acquireWithinOrganizationScope(
        reservation,
        [organizationBId, organizationCId],
        1200,
      ),
    ).rejects.toThrow('Reservation scope must include the target organization');

    expect(client.eval).not.toHaveBeenCalled();
  });

  it('returns false when Redis reports a conflicting scope lock', async () => {
    client.eval.mockResolvedValue(0);

    await expect(
      repository.acquireWithinOrganizationScope(
        reservation,
        [organizationAId, organizationBId],
        1200,
      ),
    ).resolves.toBe(false);
  });

  it('finds the exact campaign-prospect reservation', async () => {
    client.get.mockResolvedValue(JSON.stringify(reservation));

    await expect(repository.findCurrent(tenantId, campaignId, campaignProspectId)).resolves.toEqual(
      reservation,
    );

    expect(client.get).toHaveBeenCalledWith(
      repository.buildKey(tenantId, campaignId, campaignProspectId),
    );
  });

  it('returns null when the exact reservation does not exist', async () => {
    client.get.mockResolvedValue(null);

    await expect(
      repository.findCurrent(tenantId, campaignId, campaignProspectId),
    ).resolves.toBeNull();
  });

  it('finds the current reservation for one organization and establishment', async () => {
    client.get.mockResolvedValue(JSON.stringify(reservation));

    await expect(
      repository.findCurrentByOrganizationEstablishment(tenantId, organizationAId, establishmentId),
    ).resolves.toEqual(reservation);

    expect(client.get).toHaveBeenCalledWith(
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    );
  });

  it('returns null when no organization-scoped establishment reservation exists', async () => {
    client.get.mockResolvedValue(null);

    await expect(
      repository.findCurrentByOrganizationEstablishment(tenantId, organizationAId, establishmentId),
    ).resolves.toBeNull();
  });

  it('returns reservation candidates across an organization scope', async () => {
    const secondReservation: ProspectReservation = {
      ...reservation,

      reservationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      organizationId: organizationBId,

      campaignId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      campaignProspectId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    };

    client.mGet.mockResolvedValue([
      JSON.stringify(reservation),

      null,

      JSON.stringify(secondReservation),
    ]);

    await expect(
      repository.findCurrentCandidatesByOrganizations(tenantId, establishmentId, [
        organizationAId,
        organizationCId,
        organizationBId,
      ]),
    ).resolves.toEqual([reservation, secondReservation]);

    expect(client.mGet).toHaveBeenCalledWith([
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),

      repository.buildOrganizationCollisionKey(tenantId, organizationCId, establishmentId),

      repository.buildOrganizationCollisionKey(tenantId, organizationBId, establishmentId),
    ]);
  });

  it('deduplicates organization ids when reading reservation candidates', async () => {
    client.mGet.mockResolvedValue([JSON.stringify(reservation), null]);

    await repository.findCurrentCandidatesByOrganizations(tenantId, establishmentId, [
      organizationAId,
      organizationAId,
      organizationBId,
      organizationBId,
    ]);

    expect(client.mGet).toHaveBeenCalledTimes(1);

    const keys = client.mGet.mock.calls[0]?.[0] as string[];

    expect(keys).toHaveLength(2);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not query Redis when candidate organization scope is empty', async () => {
    await expect(
      repository.findCurrentCandidatesByOrganizations(tenantId, establishmentId, []),
    ).resolves.toEqual([]);

    expect(client.mGet).not.toHaveBeenCalled();
  });

  it('uses the organization-scoped key during release', async () => {
    client.eval.mockResolvedValue(1);

    await expect(
      repository.releaseOrganizationScoped(
        tenantId,
        campaignId,
        campaignProspectId,
        organizationAId,
        establishmentId,
        reservation.reservationId,
      ),
    ).resolves.toBe(true);

    expect(client.eval).toHaveBeenCalledTimes(1);

    const [script, options] = client.eval.mock.calls[0] as [
      string,
      {
        keys: string[];
        arguments: string[];
      },
    ];

    expect(script).toContain('reservation.organizationId ~= ARGV[2]');

    expect(options.keys).toEqual([
      repository.buildKey(tenantId, campaignId, campaignProspectId),

      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    ]);

    expect(options.arguments).toEqual([reservation.reservationId, organizationAId]);
  });

  it('returns false when organization-scoped release reports no matching reservation', async () => {
    client.eval.mockResolvedValue(0);

    await expect(
      repository.releaseOrganizationScoped(
        tenantId,
        campaignId,
        campaignProspectId,
        organizationAId,
        establishmentId,
        reservation.reservationId,
      ),
    ).resolves.toBe(false);
  });

  it('returns the exact reservation TTL', async () => {
    client.ttl.mockResolvedValue(1197);

    await expect(repository.ttl(tenantId, campaignId, campaignProspectId)).resolves.toBe(1197);

    expect(client.ttl).toHaveBeenCalledWith(
      repository.buildKey(tenantId, campaignId, campaignProspectId),
    );
  });

  it('returns the organization-scoped collision TTL', async () => {
    client.ttl.mockResolvedValue(1195);

    await expect(
      repository.organizationCollisionTtl(tenantId, organizationAId, establishmentId),
    ).resolves.toBe(1195);

    expect(client.ttl).toHaveBeenCalledWith(
      repository.buildOrganizationCollisionKey(tenantId, organizationAId, establishmentId),
    );
  });

  it('still supports the legacy tenant-wide collision TTL during migration', async () => {
    client.ttl.mockResolvedValue(300);

    await expect(repository.collisionTtl(tenantId, establishmentId)).resolves.toBe(300);

    expect(client.ttl).toHaveBeenCalledWith(
      repository.buildCollisionKey(tenantId, establishmentId),
    );
  });
});
