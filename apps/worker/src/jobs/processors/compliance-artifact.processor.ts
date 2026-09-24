import { Inject, Injectable, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import type { ComplianceArtifactJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';
import type { JobProcessorResult } from '../job-processing.types.js';
import { WorkerArtifactStorageService } from '../../providers/worker-artifact-storage.service.js';
@Injectable()
export class ComplianceArtifactProcessor {
  constructor(
    @Inject(WORKER_DATABASE_POOL) private readonly db: Pool,
    @Optional()
    @Inject(WorkerArtifactStorageService)
    private readonly storage: {
      put: (
        key: string,
        body: string,
        contentType: string,
      ) => Promise<{ key: string; uploaded: boolean }>;
    } = {
      put: async (key: string) => ({ key, uploaded: false }),
    },
  ) {}
  async process(data: ComplianceArtifactJobData): Promise<JobProcessorResult> {
    const source = await workerTenantQuery<{ scope: unknown }>(
      this.db,
      data.tenantId,
      'SELECT scope FROM evidence_exports WHERE id=$1 AND tenant_id=$2',
      [data.exportId, data.tenantId],
    );
    if (!source.rows[0]) return { status: 'noop', reason: 'export missing' };
    const evidence = await workerTenantQuery(
      this.db,
      data.tenantId,
      'SELECT id,event_type,created_at,actor_id,metadata FROM audit_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 10000',
      [data.tenantId],
    );
    const key = `${data.tenantId}/evidence/${data.exportId}.json`;
    await this.storage.put(
      key,
      JSON.stringify({
        exportId: data.exportId,
        scope: source.rows[0].scope,
        evidence: evidence.rows,
      }),
      'application/json',
    );
    const r = await workerTenantQuery(
      this.db,
      data.tenantId,
      "UPDATE evidence_exports SET status=$1,object_key=$2,expires_at=clock_timestamp()+interval '24 hours' WHERE id=$3 AND tenant_id=$4 RETURNING id",
      ['ready', key, data.exportId, data.tenantId],
    );
    if (!r.rows[0]) return { status: 'noop', reason: 'export disappeared' };
    return { status: 'processed' };
  }
}
