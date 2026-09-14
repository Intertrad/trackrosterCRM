import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';

import { IdempotencyRecordRepository } from './idempotency-record.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [IdempotencyRecordRepository],

  exports: [IdempotencyRecordRepository],
})
export class IdempotencyRepositoryModule {}
