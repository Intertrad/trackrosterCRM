import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private readonly client: ReturnType<typeof createClient>;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');

    this.client = createClient({
      url: redisUrl,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error('Redis client error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }

    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error('Redis health check failed');
    }

    this.logger.log('Redis connection established');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch {
      throw new ServiceUnavailableException('Redis is unavailable');
    }
  }

  getClient(): ReturnType<typeof createClient> {
    return this.client;
  }
}
