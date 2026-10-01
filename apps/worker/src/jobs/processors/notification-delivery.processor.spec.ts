import { describe, expect, it, vi } from 'vitest';

import { NotificationDeliveryProcessor } from './notification-delivery.processor.js';

describe('NotificationDeliveryProcessor', () => {
  const data = {
    jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    tenantId: '11111111-1111-4111-8111-111111111111',
    requestedAt: '2026-09-24T12:00:00.000Z',
    deliveryId: '22222222-2222-4222-8222-222222222222',
  } as const;
  const context = { jobId: data.jobId, attempt: 1, maxAttempts: 3 } as const;

  it('records unavailable email providers without losing the inbox event', async () => {
    const repository = {
      findContext: vi.fn().mockResolvedValue({
        id: data.deliveryId,
        tenantId: data.tenantId,
        notificationId: '33333333-3333-4333-8333-333333333333',
        channel: 'email',
        status: 'queued',
        attempts: 0,
        recipientEmail: 'prospector@example.test',
        title: 'Follow-up due',
        message: 'A prospect follow-up is due.',
        tokens: [],
      }),
      markSending: vi.fn(),
      markFailed: vi.fn(),
      markSent: vi.fn(),
    };
    const mail = { sendNotification: vi.fn().mockResolvedValue({ sent: false, providerId: null }) };
    const push = { send: vi.fn() };
    const processor = new NotificationDeliveryProcessor(
      repository as never,
      mail as never,
      push as never,
    );

    await expect(processor.process(data, context)).resolves.toEqual({ status: 'processed' });
    expect(repository.markFailed).toHaveBeenCalledWith(
      data.tenantId,
      data.deliveryId,
      'email-provider-not-configured',
    );
    expect(repository.markSent).not.toHaveBeenCalled();
  });

  it('does not redeliver an already sent channel', async () => {
    const repository = {
      findContext: vi.fn().mockResolvedValue({ status: 'sent' }),
      markSending: vi.fn(),
    };
    const processor = new NotificationDeliveryProcessor(
      repository as never,
      {} as never,
      {} as never,
    );
    await expect(processor.process(data, context)).resolves.toEqual({
      status: 'noop',
      reason: 'delivery-already-sent',
    });
    expect(repository.markSending).not.toHaveBeenCalled();
  });
});
