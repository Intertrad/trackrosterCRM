import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DATABASE, DATABASE_POOL } from './database.constants.js';
import * as schema from './schema/index.js';
import { createRequestAwareDatabase } from './request-tenant-executor.js';
import { registerGuardDatabase } from './guard-tenant-scope.js';

export const databaseProviders: Provider[] = [
  {
    provide: DATABASE_POOL,

    inject: [ConfigService],

    useFactory: async (configService: ConfigService): Promise<Pool> => {
      const connectionString = configService.get<string>('DATABASE_URL');

      if (!connectionString) {
        throw new Error('DATABASE_URL is required');
      }

      // `pg` currently interprets sslmode=require as certificate verification
      // in some versions. Local Supabase proxies and test environments may
      // present a self-signed chain, so make that decision explicit instead of
      // relying on pg-connection-string defaults. Production should leave this
      // unset (or set it to true) and use a trusted CA chain.
      const rejectUnauthorized = configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED');
      const isDevelopment = configService.get<string>('NODE_ENV')?.toLowerCase() === 'development';
      const usesRequiredTls = /(?:^|[?&])sslmode=require(?:&|$)/i.test(connectionString);
      const explicitlyDisablesTls = /(?:^|[?&])sslmode=disable(?:&|$)/i.test(connectionString);
      const ssl =
        explicitlyDisablesTls ||
        (rejectUnauthorized === undefined && !(isDevelopment && usesRequiredTls))
          ? undefined
          : {
              rejectUnauthorized:
                rejectUnauthorized?.toLowerCase() !== 'false' &&
                !(isDevelopment && usesRequiredTls),
            };

      // pg gives sslmode in the URL precedence over the explicit `ssl` object.
      // Strip it when we provide an explicit policy, otherwise `require` can
      // silently re-enable certificate verification and reject local chains.
      let poolConnectionString = connectionString;
      if (ssl) {
        try {
          const parsed = new URL(connectionString);
          parsed.searchParams.delete('sslmode');
          parsed.searchParams.delete('uselibpqcompat');
          poolConnectionString = parsed.toString();
        } catch {
          // Preserve the original value so pg can report a normal URL error.
        }
      }

      const pool = new Pool({
        connectionString: poolConnectionString,
        ...(ssl ? { ssl } : {}),
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
      const database = createRequestAwareDatabase(
        drizzle(pool, {
          schema,
        }),
      );

      /* Guards run before the tenant interceptor and need this to open their
         own tenant scope; see guard-tenant-scope.ts. */
      registerGuardDatabase(database);

      return database;
    },
  },
];
