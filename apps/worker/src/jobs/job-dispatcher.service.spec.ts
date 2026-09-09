import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  type SystemHealthCheckJobData,
  type SystemRetryProbeJobData,
} from '@trackroster/jobs';

import { JobDispatcherService, type TrackRosterJob } from './job-dispatcher.service.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';

describe('JobDispatcherService', () => {
  let healthProcessor: {
    process: ReturnType<typeof vi.fn>;
  };

  let retryProcessor: {
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

    dispatcher = new JobDispatcherService(
      healthProcessor as unknown as SystemHealthCheckProcessor,
      retryProcessor as unknown as SystemRetryProbeProcessor,
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
  });
});
