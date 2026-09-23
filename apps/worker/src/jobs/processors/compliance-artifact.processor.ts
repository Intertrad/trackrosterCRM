import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import type { ComplianceArtifactJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import type { JobProcessorResult } from '../job-processing.types.js';
@Injectable()
export class ComplianceArtifactProcessor {
  constructor(@Inject(WORKER_DATABASE_POOL) private readonly db: Pool) {}
  async process(data: ComplianceArtifactJobData): Promise<JobProcessorResult> {
    const r = await this.db.query(
      "UPDATE evidence_exports SET status=$1,expires_at=clock_timestamp()+interval '24 hours' WHERE id=$2 AND tenant_id=$3 RETURNING id",
      ['ready', data.exportId, data.tenantId],
    );
    if (!r.rows[0]) return { status: 'noop', reason: 'export missing' };
    return { status: 'processed' };
  }
}
