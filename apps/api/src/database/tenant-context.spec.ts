import { describe, expect, it, vi } from 'vitest';
import { setTenantContext } from './tenant-context.js';

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
});
