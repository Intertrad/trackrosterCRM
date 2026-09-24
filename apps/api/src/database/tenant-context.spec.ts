import { describe, expect, it, vi } from 'vitest';
import { setTenantContext, withTenantContext } from './tenant-context.js';
import { createRequestAwareDatabase } from './request-tenant-executor.js';

describe('tenant context', () => {
  it('rejects malformed tenant identifiers before executing SQL', async () => {
    const execute = vi.fn();
    await expect(setTenantContext({ execute } as never, 'foreign')).rejects.toThrow(
      'Invalid tenant context',
    );
    expect(execute).not.toHaveBeenCalled();
  });
  it('sets transaction-local context for a valid tenant', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    await setTenantContext({ execute } as never, '11111111-1111-4111-8111-111111111111');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('routes request-aware database calls to the tenant transaction for non-HTTP work', async () => {
    const transaction = {
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      marker: 'transaction',
    };
    const database = {
      transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
      marker: 'database',
    };
    const requestAware = createRequestAwareDatabase(
      database as never,
    ) as unknown as typeof database;

    await withTenantContext(database as never, '11111111-1111-4111-8111-111111111111', async () => {
      expect(requestAware.marker).toBe('transaction');
    });

    expect(transaction.execute).toHaveBeenCalledTimes(1);
  });
});
