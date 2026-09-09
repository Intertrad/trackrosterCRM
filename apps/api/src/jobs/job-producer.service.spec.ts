import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_HEALTH_CHECK_JOB } from '@trackroster/jobs';

import { JobProducerService } from './job-producer.service.js';
import { JobQueueService } from './job-queue.service.js';

describe('JobProducerService', () => {
  let jobQueueService: {
    add: ReturnType<typeof vi.fn>;
  };

  let service: JobProducerService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const jobId = '22222222-2222-4222-8222-222222222222';

  const requestedAt = '2026-09-09T13:00:00.000Z';

  beforeEach(() => {
    jobQueueService = {
      add: vi.fn().mockResolvedValue(undefined),
    };

    service = new JobProducerService(jobQueueService as unknown as JobQueueService);
  });

  it('enqueues a typed TrackRoster job', async () => {
    const data = {
      jobId,

      tenantId,

      requestedAt,

      message: 'worker foundation check',
    };

    const result = await service.enqueue(SYSTEM_HEALTH_CHECK_JOB, data);

    expect(jobQueueService.add).toHaveBeenCalledWith(SYSTEM_HEALTH_CHECK_JOB, data, undefined);

    expect(result).toEqual({
      jobId,

      name: SYSTEM_HEALTH_CHECK_JOB,
    });
  });

  it('forwards delayed execution without exposing BullMQ options', async () => {
    const data = {
      jobId,

      tenantId,

      requestedAt,
    };

    await service.enqueue(SYSTEM_HEALTH_CHECK_JOB, data, {
      delayMs: 60_000,
    });

    expect(jobQueueService.add).toHaveBeenCalledWith(SYSTEM_HEALTH_CHECK_JOB, data, {
      delayMs: 60_000,
    });
  });
});
