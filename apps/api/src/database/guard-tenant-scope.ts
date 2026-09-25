import type { Database } from './database.types.js';
import { currentTenantExecutor } from './request-tenant-executor.js';
import { withTenantContext } from './tenant-context.js';

/*
 * Tenant context for the guard phase.
 *
 * `TenantTransactionInterceptor` opens the tenant-scoped transaction that the
 * rest of a request runs in, but Nest runs *guards before interceptors*. A
 * guard that reads tenant-scoped data therefore queries with no
 * `trackroster.tenant_id` set, and once the API connects as `trackroster_app`
 * the RLS policies answer that with zero rows — which a guard reads as "no
 * authority" and turns into 403. It fails closed rather than open, so it was
 * never a disclosure risk, but while the API connected as a superuser the
 * policies were inert and the whole class of bug was invisible.
 *
 * Guards that hit the database wrap their work in this. It is deliberately
 * re-entrant: when a scope is already active — a handler-phase call, or a
 * nested guard — the existing executor is reused rather than opening a second
 * transaction on another connection, which would both waste a connection and
 * read outside the caller's snapshot.
 *
 * The database is registered by the DATABASE provider instead of injected so
 * that adding this to a guard does not change its constructor, matching how
 * `request-tenant-executor.ts` and `tenant-context-store.ts` already hold
 * request state at module scope.
 */
let database: Database | undefined;

export function registerGuardDatabase(instance: Database): void {
  database = instance;
}

export function withGuardTenantScope<T>(
  tenantId: string | undefined,
  work: () => Promise<T>,
): Promise<T> {
  if (currentTenantExecutor() || !tenantId) {
    return work();
  }

  if (!database) {
    throw new Error('Guard tenant scope used before the database was registered');
  }

  return withTenantContext(database, tenantId, () => work());
}
