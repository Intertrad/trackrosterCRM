import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { NotificationDigestSchedulerService } from './notification-digest-scheduler.service.js';

describe('NotificationDigestSchedulerService', () => {
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';

  function createService(overrides: Record<string, string> = {}) {
    const database = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: tenantA }, { id: tenantB }]),
        }),
      }),
    };
    const jobs = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new NotificationDigestSchedulerService(
      database as never,
      jobs as never,
      new ConfigService(overrides),
    );
    return { service, database, jobs };
  }

  it('enqueues one deterministic digest per active tenant after the configured UTC hour', async () => {
    const { service, jobs } = createService({
      NOTIFICATION_DIGEST_HOUR_UTC: '8',
      NOTIFICATION_INACTIVITY_DAYS: '14',
    });

    await expect(service.drain(new Date('2026-10-01T08:15:00.000Z'))).resolves.toBe(2);
    expect(jobs.enqueue).toHaveBeenCalledTimes(2);
    expect(jobs.enqueue).toHaveBeenNthCalledWith(
      1,
      'notification.digest',
      expect.objectContaining({
        tenantId: tenantA,
        jobId: `notification-digest-${tenantA}-2026-10-01-14`,
        inactivityDays: 14,
      }),
    );
    await expect(service.drain(new Date('2026-10-01T09:00:00.000Z'))).resolves.toBe(0);
  });

  it('waits until the configured digest hour', async () => {
    const { service, jobs } = createService({ NOTIFICATION_DIGEST_HOUR_UTC: '9' });

    await expect(service.drain(new Date('2026-10-01T08:59:00.000Z'))).resolves.toBe(0);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('validates scheduler configuration bounds', () => {
    expect(() => createService({ NOTIFICATION_DIGEST_HOUR_UTC: '24' })).toThrow(
      'Notification digest value must be between 0 and 23',
    );
    expect(() => createService({ NOTIFICATION_INACTIVITY_DAYS: '0' })).toThrow(
      'Notification digest value must be between 1 and 365',
    );
  });
});
