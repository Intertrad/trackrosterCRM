import { describe, expect, it } from 'vitest';

import { PermanentJobError } from '../job-errors.js';
import { SystemHealthCheckProcessor } from './system-health-check.processor.js';

describe('SystemHealthCheckProcessor', () => {
  const processor = new SystemHealthCheckProcessor();

  const context = {
    jobId: '11111111-1111-4111-8111-111111111111',

    attempt: 1,

    maxAttempts: 3,
  };

  it('processes a valid health-check job', async () => {
    const result = await processor.process(
      {
        jobId: context.jobId,

        tenantId: '22222222-2222-4222-8222-222222222222',

        requestedAt: '2026-09-09T13:00:00.000Z',

        message: 'worker check',
      },

      context,
    );

    expect(result).toMatchObject({
      status: 'processed',

      jobId: context.jobId,

      processedAt: expect.any(String),
    });
  });

  it('rejects invalid requestedAt permanently', async () => {
    await expect(
      processor.process(
        {
          jobId: context.jobId,

          tenantId: '22222222-2222-4222-8222-222222222222',

          requestedAt: 'invalid',
        },

        context,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);
  });

  it('rejects missing tenant boundary permanently', async () => {
    await expect(
      processor.process(
        {
          jobId: context.jobId,

          tenantId: '',

          requestedAt: '2026-09-09T13:00:00.000Z',
        },

        context,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);
  });
});
