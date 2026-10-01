import { Module } from '@nestjs/common';

import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { ReservationRedisModule } from '../reservations/reservation-redis.module.js';
import { JobsQueueModule } from '../queue/jobs-queue.module.js';

import { JobConsumerService } from './job-consumer.service.js';
import { JobDispatcherService } from './job-dispatcher.service.js';
import { JobLoggingService } from './job-logging.service.js';
import { FollowUpReminderProcessor } from './processors/follow-up-reminder.processor.js';
import { ReservationExpiryProcessor } from './processors/reservation-expiry.processor.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';
import { FollowUpReminderRepository } from './repositories/follow-up-reminder.repository.js';
import { ReservationExpiryRepository } from './repositories/reservation-expiry.repository.js';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor.js';
import { ScheduledReportProcessor } from './processors/scheduled-report.processor.js';
import { ComplianceArtifactProcessor } from './processors/compliance-artifact.processor.js';
import { WorkerArtifactStorageService } from '../providers/worker-artifact-storage.service.js';
import { WorkerMailService } from '../providers/worker-mail.service.js';
import { WorkerPushService } from '../providers/worker-push.service.js';
import { ProspectGeocodeProcessor } from './processors/prospect-geocode.processor.js';
import { NotificationDeliveryProcessor } from './processors/notification-delivery.processor.js';
import { NotificationDeliveryRepository } from './repositories/notification-delivery.repository.js';
import { NotificationDigestProcessor } from './processors/notification-digest.processor.js';

@Module({
  imports: [WorkerDatabaseModule, ReservationRedisModule, JobsQueueModule],

  providers: [
    WorkerArtifactStorageService,
    WorkerMailService,
    WorkerPushService,
    JobLoggingService,

    FollowUpReminderRepository,
    NotificationDeliveryRepository,

    ReservationExpiryRepository,

    FollowUpReminderProcessor,

    ReservationExpiryProcessor,
    WebhookDeliveryProcessor,
    ScheduledReportProcessor,
    ComplianceArtifactProcessor,
    ProspectGeocodeProcessor,
    NotificationDeliveryProcessor,
    NotificationDigestProcessor,

    SystemHealthCheckProcessor,

    SystemRetryProbeProcessor,

    JobDispatcherService,

    JobConsumerService,
  ],
})
export class JobsModule {}
