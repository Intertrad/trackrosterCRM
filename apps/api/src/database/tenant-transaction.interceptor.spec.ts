import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor.js';

describe('TenantTransactionInterceptor', () => {
  it('sets bounded statement and idle transaction limits inside the tenant transaction', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const transaction = vi.fn(async (work: (tx: { execute: typeof execute }) => Promise<unknown>) =>
      work({ execute }),
    );
    const database = { transaction };
    const config = {
      get: vi.fn((key: string) =>
        key === 'DATABASE_STATEMENT_TIMEOUT_MS'
          ? '15000'
          : key === 'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS'
            ? '12000'
            : undefined,
      ),
    };
    const interceptor = new TenantTransactionInterceptor(database as never, config as never);
    const next = { handle: () => of({ ok: true }) };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: { tenantId: '11111111-1111-4111-8111-111111111111' } }),
        getResponse: () => ({ status: vi.fn() }),
      }),
    };

    await new Promise<void>((resolve, reject) => {
      interceptor.intercept(context as never, next as never).subscribe({
        complete: resolve,
        error: reject,
      });
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[1]?.[0].queryChunks).toEqual(expect.arrayContaining(['15000']));
    expect(execute.mock.calls[2]?.[0].queryChunks).toEqual(expect.arrayContaining(['12000']));
  });

  it('does not open a transaction for unauthenticated requests', () => {
    const database = { transaction: vi.fn() };
    const config = { get: vi.fn() };
    const interceptor = new TenantTransactionInterceptor(database as never, config as never);
    const next = { handle: () => of({ ok: true }) };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ auth: undefined }),
      }),
    };

    interceptor.intercept(context as never, next as never);
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
