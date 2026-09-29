import type { Database, DatabaseTransaction } from './database.types.js';
import { registerGuardDatabase } from './guard-tenant-scope.js';

/*
 * Lets a guard be unit-tested without a Nest container.
 *
 * Guards that read tenant-scoped data open their own tenant scope, because they
 * run before `TenantTransactionInterceptor` (see guard-tenant-scope.ts). That
 * scope needs the database the DATABASE provider registers at startup, which a
 * spec constructing `new SomeGuard(fakeService)` never runs — and
 * `withGuardTenantScope` throws rather than silently proceeding unscoped, since
 * in a real application an unregistered database cannot happen.
 *
 * This installs a transaction that runs the callback and accepts the
 * `set_config` the scope issues, so the guard's own logic is what the spec
 * exercises. Integration suites use the real provider and must not call this.
 */
export function registerGuardDatabaseStub(): void {
  const transaction = async <T>(work: (tx: DatabaseTransaction) => Promise<T>): Promise<T> =>
    work({ execute: async () => ({ rows: [] }) } as unknown as DatabaseTransaction);

  registerGuardDatabase({ transaction } as unknown as Database);
}
