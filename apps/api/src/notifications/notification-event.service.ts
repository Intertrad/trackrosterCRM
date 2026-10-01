import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NOTIFICATION_DELIVERY_JOB, type TrackRosterJobData } from '@trackroster/jobs';

import { JobProducerService } from '../jobs/job-producer.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { identities, tenantMemberships, userAccessGrants } from '../database/schema/index.js';
import { NotificationRepository } from './notification.repository.js';

export type MvpNotificationEvent =
  | 'follow_up_due'
  | 'reservation_expired_without_summary'
  | 'collision_or_recent_contact'
  | 'override_requested'
  | 'no_activity_for_x_days'
  | 'import_completed_with_anomalies';

export interface CreateNotificationEventInput {
  tenantId: string;
  recipientUserId: string;
  type: MvpNotificationEvent;
  severity: 'info' | 'warning' | 'error' | 'critical';
  eventKey: string;
  title: string;
  message: string;
  channels?: Array<'email' | 'push'>;
  followUpId?: string;
  scheduledFor?: Date;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationEventService {
  private readonly logger = new Logger(NotificationEventService.name);
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly repository: NotificationRepository,
    @Optional() private readonly jobs?: JobProducerService,
  ) {}

  /** Persist the in-app event first, then enqueue durable channel outboxes. */
  async create(input: CreateNotificationEventInput, executor: DatabaseExecutor = this.database) {
    const notification = await this.repository.createIfAbsent({ ...input }, executor);
    if (!notification) return null;

    for (const channel of input.channels ?? []) {
      const delivery = await this.repository.queueDelivery(
        { tenantId: input.tenantId, notificationId: notification.id, channel },
        executor,
      );
      if (delivery && this.jobs) {
        try {
          await this.jobs.enqueue(NOTIFICATION_DELIVERY_JOB, {
            jobId: randomUUID(),
            tenantId: input.tenantId,
            requestedAt: new Date().toISOString(),
            deliveryId: delivery.id,
          } satisfies TrackRosterJobData<typeof NOTIFICATION_DELIVERY_JOB>);
        } catch (error) {
          this.logger.error(
            `Notification delivery enqueue failed; durable outbox retained deliveryId=${delivery.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    }
    return notification;
  }

  async collision(
    input: {
      tenantId: string;
      prospectorUserId: string;
      campaignProspectId: string;
      reasonCode: string;
      establishmentId: string;
      collisionId?: string;
    },
    executor?: DatabaseExecutor,
  ) {
    return this.create(
      {
        tenantId: input.tenantId,
        recipientUserId: input.prospectorUserId,
        type: 'collision_or_recent_contact',
        severity: 'critical',
        eventKey: `collision:${input.collisionId ?? input.campaignProspectId}:${input.reasonCode}`,
        title: 'Collision detected',
        message: 'This prospect was contacted recently or is reserved by another workflow.',
        payload: {
          campaignProspectId: input.campaignProspectId,
          establishmentId: input.establishmentId,
          reasonCode: input.reasonCode,
        },
      },
      executor,
    );
  }

  /** Resolve managers from the tenant/team grant, never from request input. */
  async overrideRequested(
    input: {
      tenantId: string;
      teamId: string;
      campaignProspectId: string;
      requestId: string;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = executor ?? this.database;
    const managers = await db
      .select({ userId: userAccessGrants.userId })
      .from(userAccessGrants)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.tenantId, userAccessGrants.tenantId),
          eq(tenantMemberships.id, userAccessGrants.userId),
          eq(tenantMemberships.status, 'active'),
        ),
      )
      .innerJoin(
        identities,
        and(eq(identities.id, tenantMemberships.identityId), eq(identities.status, 'active')),
      )
      .where(
        and(
          eq(userAccessGrants.tenantId, input.tenantId),
          eq(userAccessGrants.role, 'manager'),
          eq(userAccessGrants.scopeType, 'team'),
          eq(userAccessGrants.teamId, input.teamId),
        ),
      );

    const notifications = [];
    for (const manager of managers) {
      const notification = await this.create(
        {
          tenantId: input.tenantId,
          recipientUserId: manager.userId,
          type: 'override_requested',
          severity: 'warning',
          eventKey: `override:${input.requestId}`,
          title: 'Override requested',
          message: 'A prospector requested a manager override for a collision.',
          channels: ['push'],
          payload: { requestId: input.requestId, campaignProspectId: input.campaignProspectId },
        },
        executor,
      );
      if (notification) notifications.push(notification);
    }
    return notifications;
  }

  async importAnomalies(
    input: {
      tenantId: string;
      importId: string;
      anomalyCount: number;
    },
    executor?: DatabaseExecutor,
  ) {
    const db = executor ?? this.database;
    const admins = await db
      .select({ userId: userAccessGrants.userId })
      .from(userAccessGrants)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.tenantId, userAccessGrants.tenantId),
          eq(tenantMemberships.id, userAccessGrants.userId),
          eq(tenantMemberships.status, 'active'),
        ),
      )
      .innerJoin(
        identities,
        and(eq(identities.id, tenantMemberships.identityId), eq(identities.status, 'active')),
      )
      .where(
        and(
          eq(userAccessGrants.tenantId, input.tenantId),
          eq(userAccessGrants.role, 'client_admin'),
          eq(userAccessGrants.scopeType, 'tenant'),
        ),
      );

    const created = [];
    for (const admin of admins) {
      const notification = await this.create(
        {
          tenantId: input.tenantId,
          recipientUserId: admin.userId,
          type: 'import_completed_with_anomalies',
          severity: 'info',
          eventKey: `import:${input.importId}:anomalies`,
          title: 'Import completed with anomalies',
          message: `${input.anomalyCount} import anomalies require review.`,
          payload: { importId: input.importId, anomalyCount: input.anomalyCount },
        },
        executor,
      );
      if (notification) created.push(notification);
    }
    return created;
  }
}
