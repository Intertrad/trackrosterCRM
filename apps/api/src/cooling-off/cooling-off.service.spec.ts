import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CoolingOffService } from './cooling-off.service.js';

describe('CoolingOffService', () => {
  let prospectActivityRepository: {
    findLatestByEstablishment: ReturnType<typeof vi.fn>;
  };

  let configService: {
    getOrThrow: ReturnType<typeof vi.fn>;
  };

  let service: CoolingOffService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const establishmentId = '22222222-2222-4222-8222-222222222222';

  const activity = {
    id: '33333333-3333-4333-8333-333333333333',

    tenantId,

    campaignId: '44444444-4444-4444-8444-444444444444',

    campaignProspectId: '55555555-5555-4555-8555-555555555555',

    establishmentId,

    assignmentId: '66666666-6666-4666-8666-666666666666',

    userId: '77777777-7777-4777-8777-777777777777',

    reservationId: '88888888-8888-4888-8888-888888888888',

    type: 'call' as const,

    occurredAt: new Date('2026-09-08T10:00:00.000Z'),

    createdAt: new Date('2026-09-08T10:00:00.000Z'),
  };

  beforeEach(() => {
    prospectActivityRepository = {
      findLatestByEstablishment: vi.fn(),
    };

    configService = {
      getOrThrow: vi.fn().mockReturnValue('1440'),
    };

    service = new CoolingOffService(
      prospectActivityRepository as unknown as ProspectActivityRepository,

      configService as unknown as ConfigService,
    );
  });

  it('returns inactive when there is no previous activity', async () => {
    prospectActivityRepository.findLatestByEstablishment.mockResolvedValue(null);

    await expect(
      service.evaluate(tenantId, establishmentId, new Date('2026-09-08T12:00:00.000Z')),
    ).resolves.toEqual({
      active: false,

      activity: null,

      expiresAt: null,
    });
  });

  it('returns active while the establishment is inside the cooling-off window', async () => {
    prospectActivityRepository.findLatestByEstablishment.mockResolvedValue(activity);

    const result = await service.evaluate(
      tenantId,
      establishmentId,
      new Date('2026-09-08T12:00:00.000Z'),
    );

    expect(result.active).toBe(true);

    expect(result.activity).toEqual(activity);

    expect(result.expiresAt).toEqual(new Date('2026-09-09T10:00:00.000Z'));
  });

  it('returns inactive after the cooling-off window expires', async () => {
    prospectActivityRepository.findLatestByEstablishment.mockResolvedValue(activity);

    const result = await service.evaluate(
      tenantId,
      establishmentId,
      new Date('2026-09-09T10:00:01.000Z'),
    );

    expect(result.active).toBe(false);

    expect(result.activity).toEqual(activity);

    expect(result.expiresAt).toEqual(new Date('2026-09-09T10:00:00.000Z'));
  });

  it('treats the exact expiry instant as no longer cooling', async () => {
    prospectActivityRepository.findLatestByEstablishment.mockResolvedValue(activity);

    const result = await service.evaluate(
      tenantId,
      establishmentId,
      new Date('2026-09-09T10:00:00.000Z'),
    );

    expect(result.active).toBe(false);
  });

  it('fails closed when activity lookup fails', async () => {
    prospectActivityRepository.findLatestByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(service.evaluate(tenantId, establishmentId)).rejects.toThrow(
      'Cooling-off service is unavailable',
    );
  });
});
