import { Module } from '@nestjs/common';

import { JobConsumerService } from './job-consumer.service.js';
import { JobDispatcherService } from './job-dispatcher.service.js';
import { JobLoggingService } from './job-logging.service.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';

@Module({
  providers: [
    JobLoggingService,

    SystemHealthCheckProcessor,

    SystemRetryProbeProcessor,

    JobDispatcherService,

    JobConsumerService,
  ],
})
export class JobsModule {}
