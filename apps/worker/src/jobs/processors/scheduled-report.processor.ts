import { Inject, Injectable, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import type { ScheduledReportJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import type { JobProcessorResult } from '../job-processing.types.js';
import { WorkerArtifactStorageService } from '../../providers/worker-artifact-storage.service.js';
import { WorkerMailService } from '../../providers/worker-mail.service.js';
@Injectable()
export class ScheduledReportProcessor {
  constructor(
    @Inject(WORKER_DATABASE_POOL) private readonly db: Pool,
    @Optional()
    @Inject(WorkerArtifactStorageService)
    private readonly storage?: WorkerArtifactStorageService,
    @Optional() @Inject(WorkerMailService) private readonly mail?: WorkerMailService,
  ) {}
  async process(data: ScheduledReportJobData): Promise<JobProcessorResult> {
    const s = await this.db.query(
      'SELECT report_key,format,recipients,filters,active FROM scheduled_reports WHERE id=$1 AND tenant_id=$2',
      [data.scheduleId, data.tenantId],
    );
    const schedule = s.rows[0];
    if (!schedule?.active) return { status: 'noop', reason: 'schedule inactive or missing' };
    const metrics = await this.db.query(
      'SELECT COUNT(*)::int AS activities, COUNT(DISTINCT prospect_id)::int AS prospects FROM activities WHERE tenant_id=$1',
      [data.tenantId],
    );
    const report = {
      reportKey: schedule.report_key,
      generatedAt: new Date().toISOString(),
      tenantId: data.tenantId,
      filters: schedule.filters ?? {},
      metrics: metrics.rows[0] ?? { activities: 0, prospects: 0 },
    };
    const csv = schedule.format === 'csv';
    const content = csv
      ? `metric,value\nactivities,${report.metrics.activities}\nprospects,${report.metrics.prospects}\n`
      : JSON.stringify(report, null, 2);
    const key = `${data.tenantId}/scheduled-reports/${data.deliveryId}.${csv ? 'csv' : 'json'}`;
    if (this.storage && typeof this.storage.put === 'function')
      await this.storage.put(key, content, csv ? 'text/csv' : 'application/json');
    if (
      this.mail &&
      typeof this.mail.sendReport === 'function' &&
      Array.isArray(schedule.recipients)
    )
      await this.mail.sendReport(
        schedule.recipients,
        `TrackRoster ${schedule.report_key} report`,
        key.split('/').pop()!,
        content,
      );
    await this.db.query(
      'UPDATE scheduled_report_deliveries SET status=$1,completed_at=clock_timestamp(),row_count=$2 WHERE id=$3 AND tenant_id=$4',
      ['delivered', 1, data.deliveryId, data.tenantId],
    );
    return { status: 'processed' };
  }
}
