import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class ReservationRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationRedisService.name);

  private readonly client: Redis;

  constructor(configService: ConfigService) {
    const redisUrl = configService.getOrThrow<string>('REDIS_URL');

    /*
     * This connection is intentionally separate
     * from BullMQ's queue/worker connections.
     *
     * It is used only for TrackRoster reservation
     * domain state.
     */
    this.client = new Redis(redisUrl, {
      lazyConnect: true,

      maxRetriesPerRequest: 3,

      enableReadyCheck: true,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('Reservation Redis connection error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    await this.client.ping();

    this.logger.log('Reservation Redis connection ready');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'end') {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }

    this.logger.log('Reservation Redis connection closed');
  }

  getClient(): Redis {
    return this.client;
  }
}
