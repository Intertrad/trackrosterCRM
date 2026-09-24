import { describe, expect, it } from 'vitest';
import { createRequestAwareDatabase, runWithTenantExecutor } from './request-tenant-executor.js';

describe('request-aware database', () => {
  it('routes database property access to the active transaction', async () => {
    const base = { marker: 'base' } as never;
    const transaction = { marker: 'transaction' } as never;
    const aware = createRequestAwareDatabase(base);
    expect((aware as unknown as { marker: string }).marker).toBe('base');
    await runWithTenantExecutor(transaction, async () => {
      expect((aware as unknown as { marker: string }).marker).toBe('transaction');
    });
  });
});
