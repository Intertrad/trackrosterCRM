import { Inject, Injectable } from '@nestjs/common';
import type { NotificationDigestJobData } from '@trackroster/jobs';
import type { Pool } from 'pg';

import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';
import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';

@Injectable()
export class NotificationDigestProcessor {
  constructor(@Inject(WORKER_DATABASE_POOL) private readonly pool: Pool) {}

  async process(
    data: NotificationDigestJobData,
    _context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    void _context;
    if (
      !data.jobId ||
      !data.tenantId ||
      Number.isNaN(Date.parse(data.requestedAt)) ||
      Number.isNaN(Date.parse(data.asOf))
    ) {
      throw new PermanentJobError('Invalid notification digest payload');
    }
    if (
      !Number.isInteger(data.inactivityDays) ||
      data.inactivityDays < 1 ||
      data.inactivityDays > 365
    ) {
      throw new PermanentJobError('Invalid notification digest inactivity threshold');
    }
    const day = new Date(data.asOf).toISOString().slice(0, 10);
    await workerTenantQuery(
      this.pool,
      data.tenantId,
      `
        WITH manager_scope AS (
          SELECT DISTINCT g.user_id, g.team_id
          FROM user_access_grants g
          JOIN tenant_memberships m ON m.tenant_id=g.tenant_id AND m.id=g.user_id AND m.status='active'
          JOIN identities i ON i.id=m.identity_id AND i.status='active'
          WHERE g.tenant_id=$1 AND g.role='manager' AND g.scope_type='team'
        ),
        inactive AS (
          SELECT ms.user_id, count(*)::int AS prospect_count
          FROM manager_scope ms
          JOIN campaign_prospect_assignments a ON a.tenant_id=$1 AND a.team_id=ms.team_id AND a.status IN ('active','paused')
          WHERE NOT EXISTS (
            SELECT 1 FROM prospect_activities pa
            WHERE pa.tenant_id=$1 AND pa.campaign_prospect_id=a.campaign_prospect_id
              AND pa.occurred_at >= ($2::timestamptz - ($3::text || ' days')::interval)
          )
          GROUP BY ms.user_id
        )
        INSERT INTO notifications
          (tenant_id, recipient_user_id, type, severity, event_key, title, message, payload)
        SELECT $1, i.user_id, 'no_activity_for_x_days', 'info',
               'no-activity-digest:' || $4 || ':' || i.user_id::text,
               'No activity digest',
               i.prospect_count || ' assigned prospects have had no activity for ' || $3 || ' days.',
               jsonb_build_object('inactivityDays',$3::int,'asOf',$2::timestamptz,'prospectCount',i.prospect_count)
        FROM inactive i
        WHERE i.prospect_count > 0
        ON CONFLICT (tenant_id, recipient_user_id, type, event_key) DO NOTHING
      `,
      [data.tenantId, data.asOf, data.inactivityDays, day],
    );
    return { status: 'processed' };
  }
}
