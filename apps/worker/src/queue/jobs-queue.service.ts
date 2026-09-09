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
  type TrackRosterJobName,
} from '@trackroster/jobs';

import { createQueueConnection } from './queue-connection.js';

@Injectable()
export class JobsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsQueueService.name);

  private readonly connection: Redis;

  private readonly queue: Queue<unknown, unknown, TrackRosterJobName>;

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    this.connection = createQueueConnection(redisUrl);

    this.queue = new Queue<unknown, unknown, TrackRosterJobName>(TRACKROSTER_JOB_QUEUE, {
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
    });

    this.connection.on('error', (error: Error) => {
      this.logger.error('BullMQ Redis connection error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    /*
     * Connect explicitly so worker startup fails
     * immediately if Redis is unavailable.
     */
    if (this.connection.status === 'wait') {
      await this.connection.connect();
    }

    await this.queue.waitUntilReady();

    this.logger.log(`BullMQ queue ready: ${TRACKROSTER_JOB_QUEUE}`);
  }

  async onModuleDestroy(): Promise<void> {
    /*
     * Close BullMQ before closing the external
     * ioredis connection supplied to it.
     */
    await this.queue.close();

    if (this.connection.status !== 'end') {
      try {
        await this.connection.quit();
      } catch {
        /*
         * If Redis disappeared while shutting
         * down, force-disconnect locally rather
         * than preventing process termination.
         */
        this.connection.disconnect();
      }
    }

    this.logger.log('BullMQ queue connection closed');
  }

  getQueue(): Queue<unknown, unknown, TrackRosterJobName> {
    return this.queue;
  }
}
