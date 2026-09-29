import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('health')
export class ReadinessController {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly redis: RedisService,
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
