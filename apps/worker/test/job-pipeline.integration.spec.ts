import { randomUUID } from 'node:crypto';

import { Queue, QueueEvents, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_JOB_ATTEMPTS,
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  TRACKROSTER_JOB_QUEUE,
  type TrackRosterJobData,
  type TrackRosterJobName,
} from '@trackroster/jobs';

import { JobDispatcherService, type TrackRosterJob } from '../src/jobs/job-dispatcher.service.js';
import type { JobProcessorResult } from '../src/jobs/job-processing.types.js';
import { SystemHealthCheckProcessor } from '../src/jobs/processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from '../src/jobs/processors/system-retry-probe.processor.js';
import { createQueueConnection, createWorkerConnection } from '../src/queue/queue-connection.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

describe('TrackRoster background job pipeline', () => {
  let producerConnection: Redis;

  let workerConnection: Redis;

  let eventsConnection: Redis;

  let queue: Queue<AnyTrackRosterJobData, JobProcessorResult, TrackRosterJobName>;

  let queueEvents: QueueEvents;

  let worker: Worker<AnyTrackRosterJobData, JobProcessorResult, TrackRosterJobName>;

  let healthProcessor: SystemHealthCheckProcessor;

  let retryProcessor: SystemRetryProbeProcessor;

  let dispatcher: JobDispatcherService;

  const prefix = `trackroster-test-${randomUUID()}`;

  beforeAll(async () => {
    const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

    producerConnection = createQueueConnection(redisUrl);

    workerConnection = createWorkerConnection(redisUrl);

    eventsConnection = createWorkerConnection(redisUrl);

    await Promise.all([
      producerConnection.connect(),
      workerConnection.connect(),
      eventsConnection.connect(),
    ]);

    queue = new Queue<AnyTrackRosterJobData, JobProcessorResult, TrackRosterJobName>(
      TRACKROSTER_JOB_QUEUE,
      {
        connection: producerConnection,

        /*
         * Every integration run gets its
         * own Redis namespace.
         *
         * It cannot consume or modify
         * development/production jobs.
         */
        prefix,

        defaultJobOptions: {
          attempts: DEFAULT_JOB_ATTEMPTS,

          removeOnComplete: {
            count: 100,
          },

          removeOnFail: {
            count: 100,
          },
        },
      },
    );

    queueEvents = new QueueEvents(TRACKROSTER_JOB_QUEUE, {
      connection: eventsConnection,

      prefix,
    });

    healthProcessor = new SystemHealthCheckProcessor();

    retryProcessor = new SystemRetryProbeProcessor();

    dispatcher = new JobDispatcherService(healthProcessor, retryProcessor);

    worker = new Worker<AnyTrackRosterJobData, JobProcessorResult, TrackRosterJobName>(
      TRACKROSTER_JOB_QUEUE,

      async (job) => dispatcher.dispatch(job as TrackRosterJob),

      {
        connection: workerConnection,

        prefix,

        /*
         * Deterministic integration tests.
         */
        concurrency: 1,
      },
    );

    await Promise.all([
      queue.waitUntilReady(),
      queueEvents.waitUntilReady(),
      worker.waitUntilReady(),
    ]);
  }, 15_000);

  afterAll(async () => {
    if (worker) {
      await worker.close();
    }

    if (queueEvents) {
      await queueEvents.close();
    }

    if (queue) {
      /*
       * Remove only this integration run's
       * unique-prefix data.
       */
      await queue.obliterate({
        force: true,
      });

      await queue.close();
    }

    await closeRedisConnection(producerConnection);

    await closeRedisConnection(workerConnection);

    await closeRedisConnection(eventsConnection);
  }, 15_000);

  it('enqueues and completes a health-check through Redis and BullMQ', async () => {
    const jobId = randomUUID();

    const processSpy = vi.spyOn(healthProcessor, 'process');

    try {
      const job = await queue.add(
        SYSTEM_HEALTH_CHECK_JOB,
        {
          jobId,

          tenantId: randomUUID(),

          requestedAt: new Date().toISOString(),

          message: 'integration pipeline check',
        },
        {
          jobId,
        },
      );

      const result = await job.waitUntilFinished(queueEvents, 5_000);

      expect(result).toMatchObject({
        status: 'processed',

        jobId,
      });

      expect(processSpy).toHaveBeenCalledTimes(1);

      expect(await job.getState()).toBe('completed');
    } finally {
      processSpy.mockRestore();
    }
  });

  it('retries transient failures and succeeds on the third attempt', async () => {
    const jobId = randomUUID();

    const processSpy = vi.spyOn(retryProcessor, 'process');

    try {
      const job = await queue.add(
        SYSTEM_RETRY_PROBE_JOB,
        {
          jobId,

          tenantId: randomUUID(),

          requestedAt: new Date().toISOString(),

          failThroughAttempt: 2,
        },
        {
          jobId,

          attempts: 3,

          /*
           * Keep the automated test fast.
           *
           * Production exponential backoff
           * was already verified separately.
           */
          backoff: {
            type: 'fixed',

            delay: 25,
          },
        },
      );

      const result = await job.waitUntilFinished(queueEvents, 5_000);

      expect(result).toEqual({
        status: 'processed',
      });

      expect(processSpy).toHaveBeenCalledTimes(3);

      const attempts = processSpy.mock.calls.map(([, context]) => context.attempt);

      expect(attempts).toEqual([1, 2, 3]);

      expect(await job.getState()).toBe('completed');
    } finally {
      processSpy.mockRestore();
    }
  });

  it('does not retry permanent failures', async () => {
    const jobId = randomUUID();

    const processSpy = vi.spyOn(retryProcessor, 'process');

    try {
      const job = await queue.add(
        SYSTEM_RETRY_PROBE_JOB,
        {
          jobId,

          tenantId: randomUUID(),

          requestedAt: new Date().toISOString(),

          failThroughAttempt: 2,

          permanentFailure: true,
        },
        {
          jobId,

          attempts: 3,

          backoff: {
            type: 'fixed',

            delay: 25,
          },
        },
      );

      await expect(job.waitUntilFinished(queueEvents, 5_000)).rejects.toThrow(
        'Intentional permanent retry probe failure',
      );

      expect(processSpy).toHaveBeenCalledTimes(1);

      expect(processSpy.mock.calls[0]?.[1].attempt).toBe(1);

      expect(await job.getState()).toBe('failed');
    } finally {
      processSpy.mockRestore();
    }
  });

  it('deduplicates jobs that use the same BullMQ jobId', async () => {
    const jobId = randomUUID();

    const data = {
      jobId,

      tenantId: randomUUID(),

      requestedAt: new Date().toISOString(),

      message: 'duplicate-id integration check',
    };

    /*
     * Delay it so the worker cannot complete
     * and remove/change state between our two
     * enqueue operations.
     */
    const first = await queue.add(SYSTEM_HEALTH_CHECK_JOB, data, {
      jobId,

      delay: 60_000,
    });

    const second = await queue.add(SYSTEM_HEALTH_CHECK_JOB, data, {
      jobId,

      delay: 60_000,
    });

    expect(first.id).toBe(jobId);

    expect(second.id).toBe(jobId);

    const delayedJobs = await queue.getJobs(['delayed']);

    const matchingJobs = delayedJobs.filter((queuedJob) => queuedJob.id === jobId);

    expect(matchingJobs).toHaveLength(1);

    await first.remove();
  });
});

async function closeRedisConnection(connection: Redis | undefined): Promise<void> {
  if (!connection || connection.status === 'end') {
    return;
  }

  try {
    await connection.quit();
  } catch {
    connection.disconnect();
  }
}
