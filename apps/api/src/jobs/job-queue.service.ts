import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import {
  COMPLETED_JOB_RETENTION_COUNT,
  DEFAULT_JOB_ATTEMPTS,
  DEFAULT_JOB_BACKOFF_DELAY_MS,
  FAILED_JOB_RETENTION_COUNT,
  TRACKROSTER_JOB_PREFIX,
  TRACKROSTER_JOB_QUEUE,
  type TrackRosterJobData,
  type TrackRosterJobName,
} from '@trackroster/jobs';

import { createJobQueueConnection } from './queue-connection.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);

  private readonly connection: Redis;

  private readonly queue: Queue<AnyTrackRosterJobData, unknown, TrackRosterJobName>;

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    this.connection = createJobQueueConnection(redisUrl);

    this.queue = new Queue<AnyTrackRosterJobData, unknown, TrackRosterJobName>(
      TRACKROSTER_JOB_QUEUE,
      {
        connection: this.connection,

        prefix: TRACKROSTER_JOB_PREFIX,

        defaultJobOptions: {
          attempts: DEFAULT_JOB_ATTEMPTS,

          backoff: {
            type: 'exponential',

            delay: DEFAULT_JOB_BACKOFF_DELAY_MS,
          },

          removeOnComplete: {
            count: COMPLETED_JOB_RETENTION_COUNT,
          },

          removeOnFail: {
            count: FAILED_JOB_RETENTION_COUNT,
          },
        },
      },
    );

    this.connection.on('error', (error: Error) => {
      this.logger.error('BullMQ producer Redis connection error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    /*
     * API startup should fail instead of silently
     * accepting requests when its asynchronous
     * job infrastructure cannot initialize.
     */
    if (this.connection.status === 'wait') {
      await this.connection.connect();
    }

    await this.queue.waitUntilReady();

    this.logger.log(`BullMQ producer queue ready: ${TRACKROSTER_JOB_QUEUE}`);
  }

  async add<TName extends TrackRosterJobName>(
    name: TName,

    data: TrackRosterJobData<TName>,

    options?: {
      delayMs?: number;
    },
  ): Promise<void> {
    /*
     * The application-level UUID is also used as
     * BullMQ's job ID.
     *
     * This means retrying the same enqueue request
     * with the same jobId does not create another
     * queue identity while that job is retained.
     *
     * Domain-level idempotency is still required
     * for business side effects.
     */
    await this.queue.add(
      name,

      data,

      {
        jobId: data.jobId,

        ...(options?.delayMs !== undefined
          ? {
              delay: options.delayMs,
            }
          : {}),
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();

    if (this.connection.status !== 'end') {
      try {
        await this.connection.quit();
      } catch {
        this.connection.disconnect();
      }
    }

    this.logger.log('BullMQ producer queue connection closed');
  }
}
