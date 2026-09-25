import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookDeliveryProcessor } from './webhook-delivery.processor.js';
describe('WebhookDeliveryProcessor', () => {
  afterEach(() => vi.unstubAllGlobals());
  const data = {
    jobId: 'j',
    /*
     * A real uuid: withWorkerTenantTransaction validates the tenant before it
     * sets trackroster.tenant_id, rather than interpolating whatever it is
     * given, so a placeholder now fails with "Invalid tenant context" before
     * the processor does anything.
     */
    tenantId: '11111111-1111-4111-8111-111111111111',
    requestedAt: new Date().toISOString(),
    deliveryId: 'd',
    webhookId: 'w',
    event: 'test',
    payload: { ok: true },
  };

  /*
   * The processor routes its queries through withWorkerTenantTransaction, so a
   * bare { query } double is no longer enough: the helper checks out a client
   * with pool.connect() and issues BEGIN, a set_config for the tenant, and
   * COMMIT around the work. Those control statements would otherwise consume the
   * mocked webhook row, so they are answered separately and only the business
   * queries draw from `rows`.
   */
  const poolDouble = (first: { rows: unknown[] }) => {
    let servedFirst = false;

    const query = vi.fn(async (text: string) => {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(text) || text.includes('set_config'))
        return { rows: [] };

      if (!servedFirst) {
        servedFirst = true;
        return first;
      }

      return { rows: [] };
    });

    return {
      pool: { connect: async () => ({ query, release: () => undefined }) },
      query,
    };
  };

  it('signs and delivers payloads', async () => {
    const { pool } = poolDouble({
      rows: [{ url: 'https://receiver.test', secret_hash: 'secret', active: true }],
    });
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetch);
    const result = await new WebhookDeliveryProcessor(pool as never).process(data, {
      jobId: 'j',
      attempt: 1,
      maxAttempts: 3,
    });
    expect(result.status).toBe('processed');
    expect(fetch.mock.calls[0]![1].headers['x-trackroster-signature']).toMatch(/^sha256=/);
  });
  it('dead-letters after the final attempt', async () => {
    const { pool } = poolDouble({
      rows: [{ url: 'https://receiver.test', secret_hash: 'secret', active: true }],
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const result = await new WebhookDeliveryProcessor(pool as never).process(data, {
      jobId: 'j',
      attempt: 5,
      maxAttempts: 5,
    });
    expect(result).toEqual({ status: 'noop', reason: 'webhook moved to dead letter' });
  });
});
