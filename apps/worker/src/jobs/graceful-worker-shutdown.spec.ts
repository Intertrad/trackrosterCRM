import { describe, expect, it, vi } from 'vitest';

import { closeWorkerGracefully } from './graceful-worker-shutdown.js';

describe('closeWorkerGracefully', () => {
  it('allows the worker to finish gracefully', async () => {
    const worker = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    const result = await closeWorkerGracefully(worker, 1_000);

    expect(result).toBe('graceful');

    expect(worker.close).toHaveBeenCalledTimes(1);

    expect(worker.close).toHaveBeenCalledWith(false);
  });

  it('waits for an active graceful close', async () => {
    const worker = {
      close: vi.fn(async (force?: boolean) => {
        if (force) {
          return;
        }

        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
      }),
    };

    const result = await closeWorkerGracefully(worker, 1_000);

    expect(result).toBe('graceful');

    expect(worker.close).toHaveBeenCalledTimes(1);
  });

  it('force-closes a worker after the grace period expires', async () => {
    const worker = {
      close: vi.fn((force?: boolean) => {
        if (force) {
          return Promise.resolve();
        }

        /*
         * Simulates a processor that never
         * finishes its active job.
         */
        return new Promise<void>(() => {});
      }),
    };

    const result = await closeWorkerGracefully(worker, 10);

    expect(result).toBe('forced');

    expect(worker.close).toHaveBeenNthCalledWith(1, false);

    expect(worker.close).toHaveBeenNthCalledWith(2, true);
  });

  it('propagates unexpected graceful-close failures', async () => {
    const worker = {
      close: vi.fn().mockRejectedValue(new Error('close failed')),
    };

    await expect(closeWorkerGracefully(worker, 1_000)).rejects.toThrow('close failed');
  });
});
