import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { ScheduledReportJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import type { JobProcessorResult } from '../job-processing.types.js';
@Injectable()
export class ScheduledReportProcessor {
  constructor(
    @Inject(WORKER_DATABASE_POOL) private readonly db: Pool,
    config?: unknown,
  ) {
    void config;
  }
  async process(data: ScheduledReportJobData): Promise<JobProcessorResult> {
    const s = await this.db.query(
      'SELECT active FROM scheduled_reports WHERE id=$1 AND tenant_id=$2',
      [data.scheduleId, data.tenantId],
    );
    if (!s.rows[0]?.active) return { status: 'noop', reason: 'schedule inactive or missing' };
    await this.db.query(
      'UPDATE scheduled_report_deliveries SET status=$1,completed_at=clock_timestamp() WHERE id=$2 AND tenant_id=$3',
      ['delivered', data.deliveryId, data.tenantId],
    );
    return { status: 'processed' };
  }
}
