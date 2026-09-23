import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor.js';
describe('WebhookDeliveryProcessor', () => {
  afterEach(() => vi.unstubAllGlobals());
  const data = {
    jobId: 'j',
    tenantId: 't',
    requestedAt: new Date().toISOString(),
    deliveryId: 'd',
    webhookId: 'w',
    event: 'test',
    payload: { ok: true },
  };
  it('signs and delivers payloads', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ url: 'https://receiver.test', secret_hash: 'secret', active: true }],
      })
      .mockResolvedValue({ rows: [] });
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetch);
    const result = await new WebhookDeliveryProcessor({ query } as never).process(data, {
      jobId: 'j',
      attempt: 1,
      maxAttempts: 3,
    });
    expect(result.status).toBe('processed');
    expect(fetch.mock.calls[0]![1].headers['x-trackroster-signature']).toMatch(/^sha256=/);
  });
  it('dead-letters after the final attempt', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ url: 'https://receiver.test', secret_hash: 'secret', active: true }],
      })
      .mockResolvedValue({ rows: [] });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await new WebhookDeliveryProcessor({ query } as never).process(data, {
      jobId: 'j',
      attempt: 5,
      maxAttempts: 5,
    });
    expect(result).toEqual({ status: 'noop', reason: 'webhook moved to dead letter' });
  });
});
