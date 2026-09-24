import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { DATABASE, DATABASE_POOL } from './database.constants.js';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';
import { databaseProviders } from './database.provider.js';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.js';

@Module({
  providers: [
    ...databaseProviders,
    DatabaseLifecycleService,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule {}
