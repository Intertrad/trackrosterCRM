import { describe, expect, it, vi } from 'vitest';
import { withWorkerTenantTransaction } from './worker-tenant-transaction.js';

describe('withWorkerTenantTransaction', () => {
  it('sets a transaction-local tenant and commits work', async () => {
    const client = { query: vi.fn().mockResolvedValue({}), release: vi.fn() };
    const result = await withWorkerTenantTransaction(
      { connect: vi.fn().mockResolvedValue(client) },
      '11111111-1111-4111-8111-111111111111',
      async (tx) => {
        await tx.query('SELECT 42');
        return 'ok';
      },
    );
    expect(result).toBe('ok');
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('trackroster.tenant_id', $1, true)",
      ['11111111-1111-4111-8111-111111111111'],
    );
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });
});
