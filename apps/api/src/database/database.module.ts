import { Module } from '@nestjs/common';

import { DATABASE, DATABASE_POOL } from './database.constants.js';
import { DatabaseLifecycleService } from './database-lifecycle.service.js';
import { databaseProviders } from './database.provider.js';

@Module({
  providers: [...databaseProviders, DatabaseLifecycleService],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule {}
