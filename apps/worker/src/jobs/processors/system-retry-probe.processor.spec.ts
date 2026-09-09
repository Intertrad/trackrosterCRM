import { describe, expect, it } from 'vitest';

import { PermanentJobError } from '../job-errors.js';
import { SystemRetryProbeProcessor } from './system-retry-probe.processor.js';

describe('SystemRetryProbeProcessor', () => {
  const processor = new SystemRetryProbeProcessor();

  const data = {
    jobId: '11111111-1111-4111-8111-111111111111',

    tenantId: '22222222-2222-4222-8222-222222222222',

    requestedAt: '2026-09-09T13:00:00.000Z',

    failThroughAttempt: 2,
  };

  it('throws retryable Error before the configured successful attempt', async () => {
    await expect(
      processor.process(
        data,

        {
          jobId: data.jobId,

          attempt: 1,

          maxAttempts: 3,
        },
      ),
    ).rejects.toThrow('Intentional retryable failure');
  });

  it('succeeds after temporary failures', async () => {
    await expect(
      processor.process(
        data,

        {
          jobId: data.jobId,

          attempt: 3,

          maxAttempts: 3,
        },
      ),
    ).resolves.toEqual({
      status: 'processed',
    });
  });

  it('uses an unrecoverable error for permanent failures', async () => {
    await expect(
      processor.process(
        {
          ...data,

          permanentFailure: true,
        },

        {
          jobId: data.jobId,

          attempt: 1,

          maxAttempts: 3,
        },
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);
  });
});
