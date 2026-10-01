import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';
import { ObjectStorageService } from '../providers/object-storage.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('health')
export class ReadinessController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly storage: ObjectStorageService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const query = { text: 'SELECT 1', query_timeout: 1500 };
    const results = await Promise.allSettled([
      this.withDeadline(this.pool.query(query)),
      this.withDeadline(
        this.redis.ping().then((response) => {
          if (response !== 'PONG') throw new Error('Redis unavailable');
        }),
      ),
    ]);
    const dependencies = {
      postgres: results[0]!.status === 'fulfilled' ? 'up' : 'down',
      redis: results[1]!.status === 'fulfilled' ? 'up' : 'down',
      optional: {
        objectStorage: this.storage.configured() ? 'configured' : 'unconfigured',
        email:
          this.config.get<string>('BREVO_API_KEY') && this.config.get<string>('BREVO_SENDER_EMAIL')
            ? 'configured'
            : 'unconfigured',
        maps: this.config.get<string>('NEXT_PUBLIC_PMTILES_URL') ? 'configured' : 'unconfigured',
        sso: this.config.get<string>('SSO_ENCRYPTION_KEY') ? 'configured' : 'unconfigured',
      },
    };
    if (results.some((result) => result.status === 'rejected'))
      throw new ServiceUnavailableException({ status: 'not_ready', dependencies });
    return { status: 'ready', dependencies };
  }

  private async withDeadline<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Dependency deadline exceeded')), 2000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
