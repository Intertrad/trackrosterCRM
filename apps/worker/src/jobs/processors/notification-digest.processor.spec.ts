import { describe, expect, it, vi } from 'vitest';

import { NotificationDigestProcessor } from './notification-digest.processor.js';

describe('NotificationDigestProcessor', () => {
  it('runs a tenant-scoped daily deduplicated digest query', async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const processor = new NotificationDigestProcessor(pool as never);

    await expect(
      processor.process(
        {
          jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          tenantId: '11111111-1111-4111-8111-111111111111',
          requestedAt: '2026-09-24T12:00:00.000Z',
          asOf: '2026-09-24T12:00:00.000Z',
          inactivityDays: 7,
        },
        { jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', attempt: 1, maxAttempts: 3 },
      ),
    ).resolves.toEqual({ status: 'processed' });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("'no_activity_for_x_days'"),
      expect.any(Array),
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (tenant_id, recipient_user_id, type, event_key)'),
      expect.any(Array),
    );
    expect(client.release).toHaveBeenCalled();
  });
});
