import { Controller, Get, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.constants.js';
import { ObjectStorageService } from '../providers/object-storage.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('health')
export class ReadinessController {
  private readonly logger = new Logger(ReadinessController.name);

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
    const query = {
      text: `SELECT 1, (
        SELECT count(*)::int
        FROM auth_mail_outbox
        WHERE failed_at IS NOT NULL
          AND delivered_at IS NULL
          AND created_at >= clock_timestamp() - interval '24 hours'
      ) AS "terminalFailures"`,
      query_timeout: 1500,
    };
    const results = await Promise.allSettled([
      this.withDeadline(this.pool.query(query)),
      this.withDeadline(
        this.redis.ping().then((response) => {
          if (response !== 'PONG') throw new Error('Redis unavailable');
        }),
      ),
    ]);
    const postgresResult = results[0];
    const terminalFailures =
      postgresResult.status === 'fulfilled'
        ? Number(postgresResult.value.rows[0]?.terminalFailures ?? 0)
        : null;
    const emailConfigured =
      (this.config.get<string>('MAILPIT_URL') && this.config.get('NODE_ENV') !== 'production') ||
      (this.config.get<string>('BREVO_API_KEY') && this.config.get<string>('BREVO_SENDER_EMAIL'));
    if (this.pool.waitingCount > 0) {
      this.logger.warn(
        `PostgreSQL pool has ${this.pool.waitingCount} waiting request(s); total=${this.pool.totalCount} idle=${this.pool.idleCount}`,
      );
    }
    const dependencies = {
      postgres: postgresResult.status === 'fulfilled' ? 'up' : 'down',
      postgresPool: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount,
        max: Number(this.config.get<string>('API_DATABASE_POOL_MAX') ?? 8),
        aggregateBudget: Number(this.config.get<string>('DATABASE_POOL_BUDGET') ?? 12),
        estimatedAggregate: this.estimatedAggregatePoolConnections(),
        utilization:
          this.pool.totalCount > 0
            ? Number(
                ((this.pool.totalCount - this.pool.idleCount) / this.pool.totalCount).toFixed(3),
              )
            : 0,
      },
      redis: results[1]!.status === 'fulfilled' ? 'up' : 'down',
      optional: {
        objectStorage: this.storage.configured() ? 'configured' : 'unconfigured',
        email: emailConfigured ? 'configured' : 'unconfigured',
        emailDelivery: {
          status: !emailConfigured
            ? 'unconfigured'
            : terminalFailures === null
              ? 'unknown'
              : terminalFailures > 0
                ? 'degraded'
                : 'healthy',
          terminalFailures: emailConfigured ? terminalFailures : 0,
        },
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

  private estimatedAggregatePoolConnections(): number {
    const apiMax = Number(this.config.get<string>('API_DATABASE_POOL_MAX') ?? 8);
    const workerMax = Number(this.config.get<string>('WORKER_DATABASE_POOL_MAX') ?? 4);
    const apiReplicas = Number(this.config.get<string>('API_DATABASE_REPLICA_COUNT') ?? 1);
    const workerReplicas = Number(this.config.get<string>('WORKER_DATABASE_REPLICA_COUNT') ?? 1);
    return apiMax * apiReplicas + workerMax * workerReplicas;
  }
}
