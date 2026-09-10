import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Pool } from 'pg';

import { WORKER_DATABASE_POOL } from './worker-database.constants.js';

@Injectable()
export class WorkerDatabaseLifecycleService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkerDatabaseLifecycleService.name);

  constructor(
    @Inject(WORKER_DATABASE_POOL)
    private readonly pool: Pool,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();

    this.logger.log('Worker PostgreSQL connection pool closed');
  }
}
