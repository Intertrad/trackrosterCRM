import { Module } from '@nestjs/common';
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
