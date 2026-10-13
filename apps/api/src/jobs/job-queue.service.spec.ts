import { describe, expect, it, vi } from 'vitest';

import { JobQueueService } from './job-queue.service.js';

describe('JobQueueService health snapshot', () => {
  it('returns queue counts without exposing job payloads', async () => {
    const getJobCounts = vi.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      delayed: 3,
      failed: 4,
      completed: 99,
    });
    const service = Object.create(JobQueueService.prototype) as JobQueueService;
    Object.assign(service, { queue: { getJobCounts } });

    await expect(service.healthSnapshot()).resolves.toEqual({
      waiting: 2,
      active: 1,
      delayed: 3,
      failed: 4,
    });
    expect(getJobCounts).toHaveBeenCalledWith('waiting', 'active', 'delayed', 'failed');
  });
});
