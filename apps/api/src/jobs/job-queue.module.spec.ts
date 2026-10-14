import 'reflect-metadata';

import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { JobQueueModule } from './job-queue.module.js';
import { JobQueueService } from './job-queue.service.js';
import { JobProducerService } from './job-producer.service.js';

describe('JobQueueModule', () => {
  it('exports queue health and producer services to importing modules', () => {
    const exports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, JobQueueModule) as unknown[];

    expect(exports).toEqual(expect.arrayContaining([JobProducerService, JobQueueService]));
  });
});
