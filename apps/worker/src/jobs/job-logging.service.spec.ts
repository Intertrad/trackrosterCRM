import { Logger } from '@nestjs/common';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { JobLoggingService } from './job-logging.service.js';

describe('JobLoggingService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const metadata = {
    jobId: '11111111-1111-4111-8111-111111111111',

    jobName: 'system.health-check' as const,

    tenantId: '22222222-2222-4222-8222-222222222222',

    attempt: 1,

    maxAttempts: 3,
  };

  it('logs structured job start metadata', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const service = new JobLoggingService();

    service.started(metadata);

    const message = String(logSpy.mock.calls[0]?.[0]);

    expect(JSON.parse(message)).toEqual({
      event: 'job.started',

      ...metadata,
    });
  });

  it('logs structured successful processing', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const service = new JobLoggingService();

    service.processed(metadata, 42);

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual({
      event: 'job.processed',

      ...metadata,

      durationMs: 42,

      outcome: 'processed',
    });
  });

  it('logs business no-op reasons', () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const service = new JobLoggingService();

    service.noop(metadata, 10, 'follow-up already completed');

    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toMatchObject({
      event: 'job.noop',

      outcome: 'noop',

      reason: 'follow-up already completed',

      durationMs: 10,
    });
  });

  it('logs failure metadata without logging job payloads', () => {
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const service = new JobLoggingService();

    service.failed(metadata, 25, new Error('temporary failure'));

    const record = JSON.parse(String(errorSpy.mock.calls[0]?.[0]));

    expect(record).toMatchObject({
      event: 'job.failed',

      ...metadata,

      durationMs: 25,

      outcome: 'failed',

      errorName: 'Error',

      errorMessage: 'temporary failure',
    });

    expect(record).not.toHaveProperty('data');

    expect(record).not.toHaveProperty('payload');
  });
});
