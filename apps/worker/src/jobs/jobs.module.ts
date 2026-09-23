import { Module } from '@nestjs/common';

import { WorkerDatabaseModule } from '../database/worker-database.module.js';
import { ReservationRedisModule } from '../reservations/reservation-redis.module.js';

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

@Module({
  imports: [WorkerDatabaseModule, ReservationRedisModule],

  providers: [
    JobLoggingService,

    FollowUpReminderRepository,

    ReservationExpiryRepository,

    FollowUpReminderProcessor,

    ReservationExpiryProcessor,
    WebhookDeliveryProcessor,

    SystemHealthCheckProcessor,

    SystemRetryProbeProcessor,

    JobDispatcherService,

    JobConsumerService,
  ],
})
export class JobsModule {}
