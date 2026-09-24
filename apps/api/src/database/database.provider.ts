import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, DATABASE_POOL } from './database.constants.js';
import * as schema from './schema/index.js';
import { createRequestAwareDatabase } from './request-tenant-executor.js';

export const databaseProviders: Provider[] = [
  {
    provide: DATABASE_POOL,

    inject: [ConfigService],

    useFactory: async (configService: ConfigService): Promise<Pool> => {
      const connectionString = configService.get<string>('DATABASE_URL');

      if (!connectionString) {
        throw new Error('DATABASE_URL is required');
      }

      const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000,
      });

      await pool.query('SELECT 1');

      return pool;
    },
  },

  {
    provide: DATABASE,

    inject: [DATABASE_POOL],

    useFactory: (pool: Pool) => {
      return createRequestAwareDatabase(
        drizzle(pool, {
          schema,
        }),
      );
    },
  },
];
