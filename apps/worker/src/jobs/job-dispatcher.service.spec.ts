import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FOLLOW_UP_REMINDER_JOB,
  RESERVATION_EXPIRY_JOB,
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  type FollowUpReminderJobData,
  type ReservationExpiryJobData,
  type SystemHealthCheckJobData,
  type SystemRetryProbeJobData,
} from '@trackroster/jobs';

import { JobDispatcherService, type TrackRosterJob } from './job-dispatcher.service.js';

import { FollowUpReminderProcessor } from './processors/follow-up-reminder.processor.js';
import { ReservationExpiryProcessor } from './processors/reservation-expiry.processor.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';

describe('JobDispatcherService', () => {
  let healthProcessor: {
    process: ReturnType<typeof vi.fn>;
  };

  let retryProcessor: {
    process: ReturnType<typeof vi.fn>;
  };

  let followUpReminderProcessor: {
    process: ReturnType<typeof vi.fn>;
  };

  let reservationExpiryProcessor: {
    process: ReturnType<typeof vi.fn>;
  };

  let dispatcher: JobDispatcherService;

  beforeEach(() => {
    healthProcessor = {
      process: vi.fn().mockResolvedValue({
        status: 'processed',
      }),
    };

    retryProcessor = {
      process: vi.fn().mockResolvedValue({
        status: 'processed',
      }),
    };

    followUpReminderProcessor = {
      process: vi.fn().mockResolvedValue({
        status: 'processed',
      }),
    };

    reservationExpiryProcessor = {
      process: vi.fn().mockResolvedValue({
        status: 'processed',
      }),
    };

    dispatcher = new JobDispatcherService(
      healthProcessor as unknown as SystemHealthCheckProcessor,

      retryProcessor as unknown as SystemRetryProbeProcessor,

      followUpReminderProcessor as unknown as FollowUpReminderProcessor,

      reservationExpiryProcessor as unknown as ReservationExpiryProcessor,
    );
  });

  it('dispatches system.health-check to the health processor', async () => {
    const data: SystemHealthCheckJobData = {
      jobId: '11111111-1111-4111-8111-111111111111',

      tenantId: '22222222-2222-4222-8222-222222222222',

      requestedAt: '2026-09-09T13:00:00.000Z',
    };

    const job = {
      name: SYSTEM_HEALTH_CHECK_JOB,

      data,

      attemptsMade: 0,

      opts: {
        attempts: 3,
      },
    } as unknown as TrackRosterJob;

    await dispatcher.dispatch(job);

    expect(healthProcessor.process).toHaveBeenCalledWith(data, {
      jobId: data.jobId,

      attempt: 1,

      maxAttempts: 3,
    });

    expect(retryProcessor.process).not.toHaveBeenCalled();

    expect(followUpReminderProcessor.process).not.toHaveBeenCalled();

    expect(reservationExpiryProcessor.process).not.toHaveBeenCalled();
  });

  it('dispatches system.retry-probe to the retry processor', async () => {
    const data: SystemRetryProbeJobData = {
      jobId: '33333333-3333-4333-8333-333333333333',

      tenantId: '22222222-2222-4222-8222-222222222222',

      requestedAt: '2026-09-09T13:00:00.000Z',

      failThroughAttempt: 2,
    };

    const job = {
      name: SYSTEM_RETRY_PROBE_JOB,

      data,

      attemptsMade: 1,

      opts: {
        attempts: 3,
      },
    } as unknown as TrackRosterJob;

    await dispatcher.dispatch(job);

    expect(retryProcessor.process).toHaveBeenCalledWith(data, {
      jobId: data.jobId,

      attempt: 2,

      maxAttempts: 3,
    });

    expect(healthProcessor.process).not.toHaveBeenCalled();

    expect(followUpReminderProcessor.process).not.toHaveBeenCalled();

    expect(reservationExpiryProcessor.process).not.toHaveBeenCalled();
  });

  it('dispatches follow_up.reminder to the reminder processor', async () => {
    const data: FollowUpReminderJobData = {
      jobId: '11111111-1111-4111-8111-111111111111',

      tenantId: '22222222-2222-4222-8222-222222222222',

      requestedAt: '2026-09-10T10:00:00.000Z',

      followUpId: '33333333-3333-4333-8333-333333333333',

      campaignId: '44444444-4444-4444-8444-444444444444',

      campaignProspectId: '55555555-5555-4555-8555-555555555555',

      scheduledFor: '2026-09-10T11:00:00.000Z',
    };

    const job = {
      name: FOLLOW_UP_REMINDER_JOB,

      data,

      attemptsMade: 0,

      opts: {
        attempts: 3,
      },
    } as unknown as TrackRosterJob;

    await dispatcher.dispatch(job);

    expect(followUpReminderProcessor.process).toHaveBeenCalledWith(data, {
      jobId: data.jobId,

      attempt: 1,

      maxAttempts: 3,
    });

    expect(healthProcessor.process).not.toHaveBeenCalled();

    expect(retryProcessor.process).not.toHaveBeenCalled();

    expect(reservationExpiryProcessor.process).not.toHaveBeenCalled();
  });

  it('dispatches reservation.expire to the reservation expiry processor', async () => {
    const data: ReservationExpiryJobData = {
      jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      tenantId: '11111111-1111-4111-8111-111111111111',

      requestedAt: '2026-09-10T10:00:00.000Z',

      reservationId: '22222222-2222-4222-8222-222222222222',

      organizationId: '33333333-3333-4333-8333-333333333333',

      campaignId: '44444444-4444-4444-8444-444444444444',

      campaignProspectId: '55555555-5555-4555-8555-555555555555',

      establishmentId: '66666666-6666-4666-8666-666666666666',

      expiresAt: '2026-09-10T10:20:00.000Z',
    };

    const job = {
      name: RESERVATION_EXPIRY_JOB,

      data,

      attemptsMade: 0,

      opts: {
        attempts: 3,
      },
    } as unknown as TrackRosterJob;

    await dispatcher.dispatch(job);

    expect(reservationExpiryProcessor.process).toHaveBeenCalledWith(data, {
      jobId: data.jobId,

      attempt: 1,

      maxAttempts: 3,
    });

    expect(healthProcessor.process).not.toHaveBeenCalled();

    expect(retryProcessor.process).not.toHaveBeenCalled();

    expect(followUpReminderProcessor.process).not.toHaveBeenCalled();
  });

  it('rejects unsupported jobs', async () => {
    const job = {
      name: 'unsupported.job',

      data: {
        jobId: '11111111-1111-4111-8111-111111111111',
      },

      attemptsMade: 0,

      opts: {
        attempts: 3,
      },
    } as unknown as TrackRosterJob;

    await expect(dispatcher.dispatch(job)).rejects.toThrow('Unsupported TrackRoster job');

    expect(healthProcessor.process).not.toHaveBeenCalled();

    expect(retryProcessor.process).not.toHaveBeenCalled();

    expect(followUpReminderProcessor.process).not.toHaveBeenCalled();

    expect(reservationExpiryProcessor.process).not.toHaveBeenCalled();
  });
});
