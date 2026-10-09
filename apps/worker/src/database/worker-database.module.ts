import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

import { WORKER_DATABASE_POOL } from './worker-database.constants.js';
import { WorkerDatabaseLifecycleService } from './worker-database-lifecycle.service.js';

@Module({
  providers: [
    {
      provide: WORKER_DATABASE_POOL,

      inject: [ConfigService],

      useFactory: async (configService: ConfigService): Promise<Pool> => {
        const connectionString = configService.getOrThrow<string>('DATABASE_URL');

        const pool = new Pool({
          connectionString,
          max: boundedPoolSetting(configService.get<string>('WORKER_DATABASE_POOL_MAX'), 4, 1, 15),
          idleTimeoutMillis: boundedPoolSetting(
            configService.get<string>('DATABASE_IDLE_TIMEOUT_MS'),
            30_000,
            1_000,
            300_000,
          ),
          connectionTimeoutMillis: boundedPoolSetting(
            configService.get<string>('DATABASE_CONNECTION_TIMEOUT_MS'),
            3_000,
            250,
            30_000,
          ),
        });

        const logger = new Logger('WorkerDatabasePool');
        pool.on('error', (error) => {
          logger.error(`PostgreSQL pool error: ${error.message}`);
        });

        /*
         * Fail worker startup if PostgreSQL is
         * unavailable instead of accepting jobs
         * without its required persistence layer.
         */
        await pool.query('SELECT 1');

        return pool;
      },
    },

    WorkerDatabaseLifecycleService,
  ],

  exports: [WORKER_DATABASE_POOL],
})
export class WorkerDatabaseModule {}

function boundedPoolSetting(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Database pool setting must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}
