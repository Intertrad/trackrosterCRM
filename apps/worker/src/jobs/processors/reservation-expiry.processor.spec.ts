import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReservationExpiryJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import { ReservationExpiryProcessor } from './reservation-expiry.processor.js';
import type {
  ReservationExpiryRepository,
  StoredReservation,
} from '../repositories/reservation-expiry.repository.js';

describe('ReservationExpiryProcessor', () => {
  let repository: {
    findCurrent: ReturnType<typeof vi.fn>;
    releaseIfMatch: ReturnType<typeof vi.fn>;
    notifyExpiredWithoutSummary?: ReturnType<typeof vi.fn>;
  };

  let processor: ReservationExpiryProcessor;

  const tenantId = '11111111-1111-4111-8111-111111111111';
  const reservationId = '22222222-2222-4222-8222-222222222222';
  const organizationId = '33333333-3333-4333-8333-333333333333';
  const campaignId = '44444444-4444-4444-8444-444444444444';
  const campaignProspectId = '55555555-5555-4555-8555-555555555555';
  const establishmentId = '66666666-6666-4666-8666-666666666666';

  const expiresAt = '2026-09-10T11:00:00.000Z';

  const data: ReservationExpiryJobData = {
    jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId,
    requestedAt: '2026-09-10T10:00:00.000Z',
    reservationId,
    organizationId,
    campaignId,
    campaignProspectId,
    establishmentId,
    expiresAt,
  };

  const current: StoredReservation = {
    reservationId,
    tenantId,
    organizationId,
    campaignId,
    campaignProspectId,
    establishmentId,
    assignmentId: '77777777-7777-4777-8777-777777777777',
    teamId: '88888888-8888-4888-8888-888888888888',
    userId: '99999999-9999-4999-8999-999999999999',
    acquiredAt: '2026-09-10T10:40:00.000Z',
    expiresAt,
  };

  const processingContext = {
    jobId: data.jobId,
    attempt: 1,
    maxAttempts: 3,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));

    repository = {
      findCurrent: vi.fn().mockResolvedValue(current),
      releaseIfMatch: vi.fn().mockResolvedValue(true),
    };

    processor = new ReservationExpiryProcessor(
      repository as unknown as ReservationExpiryRepository,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('noops when the job fires before expiresAt', async () => {
    vi.setSystemTime(new Date('2026-09-10T10:59:00.000Z'));

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-not-expired',
    });

    expect(repository.findCurrent).not.toHaveBeenCalled();
    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when Redis has already expired the reservation', async () => {
    repository.findCurrent.mockResolvedValue(null);

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-already-expired',
    });

    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when a newer reservation generation replaced the queued reservation', async () => {
    repository.findCurrent.mockResolvedValue({
      ...current,
      reservationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-replaced',
    });

    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when the organization scope changed', async () => {
    repository.findCurrent.mockResolvedValue({
      ...current,
      organizationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-scope-changed',
    });

    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when the establishment scope changed', async () => {
    repository.findCurrent.mockResolvedValue({
      ...current,
      establishmentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-scope-changed',
    });

    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when the reservation expiry timestamp changed', async () => {
    repository.findCurrent.mockResolvedValue({
      ...current,
      expiresAt: '2026-09-10T11:30:00.000Z',
    });

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-expiry-changed',
    });

    expect(repository.releaseIfMatch).not.toHaveBeenCalled();
  });

  it('noops when the reservation changes between lookup and atomic release', async () => {
    repository.releaseIfMatch.mockResolvedValue(false);

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'noop',
      reason: 'reservation-changed',
    });
  });

  it('atomically releases the exact expired reservation', async () => {
    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'processed',
    });

    expect(repository.findCurrent).toHaveBeenCalledWith(tenantId, campaignId, campaignProspectId);

    expect(repository.releaseIfMatch).toHaveBeenCalledWith({
      tenantId,
      reservationId,
      organizationId,
      campaignId,
      campaignProspectId,
      establishmentId,
      expiresAt,
    });
  });

  it('notifies the prospector and team managers after the exact lease is released', async () => {
    repository.notifyExpiredWithoutSummary = vi.fn().mockResolvedValue(2);

    await expect(processor.process(data, processingContext)).resolves.toEqual({
      status: 'processed',
    });

    expect(repository.notifyExpiredWithoutSummary).toHaveBeenCalledWith(current);
  });

  it('rejects a missing tenantId as a permanent payload error', async () => {
    await expect(
      processor.process(
        {
          ...data,
          tenantId: '',
        },
        processingContext,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);

    expect(repository.findCurrent).not.toHaveBeenCalled();
  });

  it('rejects an invalid requestedAt as a permanent payload error', async () => {
    await expect(
      processor.process(
        {
          ...data,
          requestedAt: 'invalid',
        },
        processingContext,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);

    expect(repository.findCurrent).not.toHaveBeenCalled();
  });

  it('rejects an invalid expiresAt as a permanent payload error', async () => {
    await expect(
      processor.process(
        {
          ...data,
          expiresAt: 'invalid',
        },
        processingContext,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);

    expect(repository.findCurrent).not.toHaveBeenCalled();
  });

  it('propagates transient Redis lookup failures so BullMQ can retry', async () => {
    repository.findCurrent.mockRejectedValue(new Error('redis unavailable'));

    await expect(processor.process(data, processingContext)).rejects.toThrow('redis unavailable');
  });

  it('propagates transient atomic-release failures so BullMQ can retry', async () => {
    repository.releaseIfMatch.mockRejectedValue(new Error('redis unavailable'));

    await expect(processor.process(data, processingContext)).rejects.toThrow('redis unavailable');
  });
});
