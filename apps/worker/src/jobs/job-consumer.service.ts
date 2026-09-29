import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';

import {
  TRACKROSTER_JOB_PREFIX,
  TRACKROSTER_JOB_QUEUE,
  type TrackRosterJobData,
  type TrackRosterJobName,
} from '@trackroster/jobs';
import { JobLoggingService } from './job-logging.service.js';

import { createWorkerConnection } from '../queue/queue-connection.js';
import { closeWorkerGracefully } from './graceful-worker-shutdown.js';
import { JobDispatcherService, type TrackRosterJob } from './job-dispatcher.service.js';
import { setWorkerTenantContext } from '../database/worker-tenant-context.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

const DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

@Injectable()
export class JobConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobConsumerService.name);

  private readonly connection: Redis;

  private readonly shutdownTimeoutMs: number;

  private worker: Worker<AnyTrackRosterJobData, unknown, TrackRosterJobName> | null = null;

  private shutdownPromise: Promise<void> | null = null;

  constructor(
    configService: ConfigService,

    private readonly dispatcher: JobDispatcherService,

    private readonly jobLogging: JobLoggingService,
  ) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    const configuredShutdownTimeout = configService.get<string | number>(
      'WORKER_SHUTDOWN_TIMEOUT_MS',
    );

    this.shutdownTimeoutMs =
      configuredShutdownTimeout === undefined
        ? DEFAULT_WORKER_SHUTDOWN_TIMEOUT_MS
        : Number(configuredShutdownTimeout);

    this.connection = createWorkerConnection(redisUrl);

    this.connection.on('error', (error: Error) => {
      this.logger.error('BullMQ worker Redis connection error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.connection.status === 'wait') {
      await this.connection.connect();
    }

    this.worker = new Worker<AnyTrackRosterJobData, unknown, TrackRosterJobName>(
      TRACKROSTER_JOB_QUEUE,

      async (job) => {
        const trackRosterJob = job as TrackRosterJob;

        const metadata = {
          jobId: trackRosterJob.data.jobId,

          jobName: trackRosterJob.name,

          tenantId: trackRosterJob.data.tenantId,

          attempt: trackRosterJob.attemptsMade + 1,

          maxAttempts: trackRosterJob.opts.attempts ?? 1,
        };

        const startedAt = Date.now();

        setWorkerTenantContext({
          tenantId: trackRosterJob.data.tenantId,
          jobId: trackRosterJob.data.jobId,
          jobName: trackRosterJob.name,
        });

        this.jobLogging.started(metadata);

        try {
          const result = await this.dispatcher.dispatch(trackRosterJob);

          const durationMs = Date.now() - startedAt;

          if (result.status === 'noop') {
            this.jobLogging.noop(metadata, durationMs, result.reason);

            return result;
          }

          this.jobLogging.processed(metadata, durationMs);

          return result;
        } catch (error: unknown) {
          const durationMs = Date.now() - startedAt;

          this.jobLogging.failed(metadata, durationMs, error);

          /*
           * Critical:
           *
           * Logging must never swallow the failure.
           * BullMQ still needs the thrown error so it
           * can retry or move the job to failed.
           */
          throw error;
        }
      },

      {
        connection: this.connection,

        prefix: TRACKROSTER_JOB_PREFIX,

        concurrency: 5,
      },
    );

    // this.worker.on('completed', (job) => {
    //   this.logger.log(`Job completed: ${job.name} (${job.id ?? 'unknown'})`);
    // });

    // this.worker.on('failed', (job, error) => {
    //   this.logger.error(
    //     `Job failed: ${job?.name ?? 'unknown'} (${job?.id ?? 'unknown'})`,
    //     error.stack,
    //   );
    // });

    this.worker.on('error', (error) => {
      this.jobLogging.workerError(error);
    });

    await this.worker.waitUntilReady();

    this.logger.log(`BullMQ consumer ready: ${TRACKROSTER_JOB_QUEUE}`);
  }

  async shutdown(): Promise<void> {
    /*
     * Nest can reach shutdown through multiple
     * lifecycle paths. Ensure the worker is only
     * drained once.
     */
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown();

    return this.shutdownPromise;
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  private async performShutdown(): Promise<void> {
    if (this.worker) {
      this.logger.log(`Draining BullMQ worker with ${this.shutdownTimeoutMs}ms timeout`);

      const result = await closeWorkerGracefully(this.worker, this.shutdownTimeoutMs);

      if (result === 'forced') {
        this.logger.warn(
          `BullMQ worker exceeded shutdown timeout and was force-closed after ${this.shutdownTimeoutMs}ms`,
        );
      } else {
        this.logger.log('BullMQ worker drained gracefully');
      }

      this.worker = null;
    }

    if (this.connection.status !== 'end') {
      try {
        await this.connection.quit();
      } catch {
        this.connection.disconnect();
      }
    }

    this.logger.log('BullMQ consumer closed');
  }
}
