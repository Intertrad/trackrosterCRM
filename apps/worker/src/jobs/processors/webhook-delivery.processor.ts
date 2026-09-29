import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { Pool } from 'pg';
import type { WebhookDeliveryJobData } from '@trackroster/jobs';
import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';
import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';
@Injectable()
export class WebhookDeliveryProcessor {
  constructor(@Inject(WORKER_DATABASE_POOL) private readonly db: Pool) {}
  async process(
    data: WebhookDeliveryJobData,
    context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    if (!data.deliveryId || !data.webhookId || !data.tenantId || !data.event)
      throw new PermanentJobError('Invalid webhook delivery payload');
    const r = await workerTenantQuery<{ url: string; secret_hash: string; active: boolean }>(
      this.db,
      data.tenantId,
      'SELECT url,secret_hash,active FROM webhooks WHERE id=$1 AND tenant_id=$2',
      [data.webhookId, data.tenantId],
    );
    const hook = r.rows[0];
    if (!hook || !hook.active) return { status: 'noop', reason: 'webhook inactive or missing' };
    const body = JSON.stringify({
      id: data.deliveryId,
      event: data.event,
      tenantId: data.tenantId,
      payload: data.payload,
    });
    const signature = createHmac('sha256', hook.secret_hash).update(body).digest('hex');
    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-trackroster-event': data.event,
          'x-trackroster-signature': `sha256=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      await workerTenantQuery(
        this.db,
        data.tenantId,
        'UPDATE webhook_deliveries SET status=$1,attempts=$2,response_code=$3,last_attempt_at=clock_timestamp() WHERE id=$4 AND tenant_id=$5',
        [
          response.ok ? 'delivered' : context.attempt >= 5 ? 'dead_letter' : 'retrying',
          String(context.attempt),
          String(response.status),
          data.deliveryId,
          data.tenantId,
        ],
      );
      if (!response.ok && context.attempt < 5)
        throw new Error(`Webhook returned ${response.status}`);
      return { status: 'processed' };
    } catch (error) {
      await workerTenantQuery(
        this.db,
        data.tenantId,
        'UPDATE webhook_deliveries SET status=$1,attempts=$2,last_attempt_at=clock_timestamp() WHERE id=$3 AND tenant_id=$4',
        [
          context.attempt >= 5 ? 'dead_letter' : 'retrying',
          String(context.attempt),
          data.deliveryId,
          data.tenantId,
        ],
      );
      if (context.attempt >= 5) return { status: 'noop', reason: 'webhook moved to dead letter' };
      throw error;
    }
  }
}
