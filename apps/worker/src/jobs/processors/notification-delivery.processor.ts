import { Injectable, Logger } from '@nestjs/common';
import type { NotificationDeliveryJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';
import { NotificationDeliveryRepository } from '../repositories/notification-delivery.repository.js';
import { WorkerMailService } from '../../providers/worker-mail.service.js';
import { WorkerPushService } from '../../providers/worker-push.service.js';

@Injectable()
export class NotificationDeliveryProcessor {
  private readonly logger = new Logger(NotificationDeliveryProcessor.name);

  constructor(
    private readonly repository: NotificationDeliveryRepository,
    private readonly mail: WorkerMailService,
    private readonly push: WorkerPushService,
  ) {}

  async process(
    data: NotificationDeliveryJobData,
    context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    if (
      !data.jobId ||
      !data.tenantId ||
      !data.deliveryId ||
      Number.isNaN(Date.parse(data.requestedAt))
    ) {
      throw new PermanentJobError('Invalid notification delivery payload');
    }
    const delivery = await this.repository.findContext(data.tenantId, data.deliveryId);
    if (!delivery) return { status: 'noop', reason: 'delivery-not-found' };
    if (delivery.status === 'sent') return { status: 'noop', reason: 'delivery-already-sent' };

    await this.repository.markSending(data.tenantId, delivery.id, delivery.attempts + 1);
    try {
      if (delivery.channel === 'email') {
        if (!delivery.recipientEmail) {
          await this.repository.markFailed(
            data.tenantId,
            delivery.id,
            'recipient-email-unavailable',
          );
          return { status: 'processed' };
        }
        const result = await this.mail.sendNotification(
          delivery.recipientEmail,
          delivery.title,
          delivery.message,
        );
        if (!result.sent) {
          await this.repository.markFailed(
            data.tenantId,
            delivery.id,
            'email-provider-not-configured',
          );
          return { status: 'processed' };
        }
        await this.repository.markSent(data.tenantId, delivery.id, result.providerId);
      } else {
        if (delivery.tokens.length === 0) {
          await this.repository.markFailed(data.tenantId, delivery.id, 'push-device-unavailable');
          return { status: 'processed' };
        }
        let delivered = false;
        let providerId: string | null = null;
        for (const token of delivery.tokens) {
          const result = await this.push.send(token, delivery.title, delivery.message);
          if (result.invalid) await this.repository.revokeTokens(data.tenantId, [token]);
          if (result.sent) {
            delivered = true;
            providerId = result.providerId;
          }
        }
        if (!delivered) {
          await this.repository.markFailed(
            data.tenantId,
            delivery.id,
            'push-provider-unavailable-or-invalid-device',
          );
          return { status: 'processed' };
        }
        await this.repository.markSent(data.tenantId, delivery.id, providerId);
      }
      this.logger.log(
        `Notification delivery processed deliveryId=${delivery.id} attempt=${context.attempt}/${context.maxAttempts}`,
      );
      return { status: 'processed' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'notification-provider-failure';
      await this.repository.markFailed(data.tenantId, delivery.id, message);
      if (context.attempt < context.maxAttempts) throw error;
      return { status: 'processed' };
    }
  }
}
