import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { WORKER_DATABASE_POOL } from '../../database/worker-database.constants.js';
import { workerTenantQuery } from '../../database/worker-tenant-transaction.js';

export interface NotificationDeliveryContext {
  id: string;
  tenantId: string;
  notificationId: string;
  channel: 'email' | 'push';
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  recipientEmail: string | null;
  title: string;
  message: string;
  tokens: string[];
}

@Injectable()
export class NotificationDeliveryRepository {
  constructor(@Inject(WORKER_DATABASE_POOL) private readonly pool: Pool) {}

  async findContext(
    tenantId: string,
    deliveryId: string,
  ): Promise<NotificationDeliveryContext | null> {
    const result = await workerTenantQuery<NotificationDeliveryContext>(
      this.pool,
      tenantId,
      `
        SELECT d.id, d.tenant_id AS "tenantId", d.notification_id AS "notificationId",
               d.channel, d.status, d.attempts,
               i.email AS "recipientEmail", n.title, n.message,
               COALESCE(array_agg(DISTINCT pd.token) FILTER (WHERE pd.token IS NOT NULL), '{}') AS tokens
        FROM notification_deliveries d
        JOIN notifications n ON n.tenant_id=d.tenant_id AND n.id=d.notification_id
        JOIN tenant_memberships m ON m.tenant_id=n.tenant_id AND m.id=n.recipient_user_id
        JOIN identities i ON i.id=m.identity_id
        LEFT JOIN push_devices pd ON pd.tenant_id=m.tenant_id AND pd.membership_id=m.id AND pd.revoked_at IS NULL
        WHERE d.tenant_id=$1 AND d.id=$2
        GROUP BY d.id, i.email, n.title, n.message
        LIMIT 1
      `,
      [tenantId, deliveryId],
    );
    return result.rows[0] ?? null;
  }

  async markSending(tenantId: string, deliveryId: string, attempts: number) {
    await workerTenantQuery(
      this.pool,
      tenantId,
      `
      UPDATE notification_deliveries
      SET status='sending', attempts=$3, updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=$1 AND id=$2 AND status IN ('queued','failed')
    `,
      [tenantId, deliveryId, attempts],
    );
  }

  async markSent(tenantId: string, deliveryId: string, providerMessageId: string | null) {
    await workerTenantQuery(
      this.pool,
      tenantId,
      `
      UPDATE notification_deliveries
      SET status='sent', provider_message_id=$3, delivered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=$1 AND id=$2
    `,
      [tenantId, deliveryId, providerMessageId],
    );
  }

  async markFailed(tenantId: string, deliveryId: string, error: string) {
    await workerTenantQuery(
      this.pool,
      tenantId,
      `
      UPDATE notification_deliveries
      SET status='failed', last_error=$3, updated_at=CURRENT_TIMESTAMP
      WHERE tenant_id=$1 AND id=$2
    `,
      [tenantId, deliveryId, error.slice(0, 2000)],
    );
  }

  async revokeTokens(tenantId: string, tokens: string[]) {
    if (tokens.length === 0) return;
    await workerTenantQuery(
      this.pool,
      tenantId,
      `
      UPDATE push_devices SET revoked_at=CURRENT_TIMESTAMP
      WHERE tenant_id=$1 AND token = ANY($2::text[])
    `,
      [tenantId, tokens],
    );
  }
}
