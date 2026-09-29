import { sql } from 'drizzle-orm';

import type { Database, DatabaseTransaction } from './database.types.js';
import { withTenantContext } from './tenant-context.js';

/*
 * The shape every timer-driven sweep in the API shares.
 *
 * A sweep runs on a timer rather than inside a request, so no interceptor has
 * opened a tenant scope for it, and it begins by asking a question that spans
 * every tenant because the queue or backlog is shared. Under
 * `trackroster_app` a context-free read of an RLS table returns zero rows, so
 * the sweep quietly does nothing at all — which is worse than failing, because
 * nothing surfaces.
 *
 * Two halves, kept deliberately separate:
 *
 *   `discover` crosses the tenant boundary, and only through a SECURITY
 *   DEFINER function that returns identifiers and nothing else (migrations
 *   0077 and 0078). It takes no locks, so a candidate is not a reservation.
 *
 *   `sweepByTenant` does the work, one tenant-scoped transaction per item, so
 *   every read and write is checked by the ordinary policies. The caller still
 *   locks the row it intends to take — `FOR UPDATE SKIP LOCKED` inside the
 *   callback — which is what settles two nodes racing for the same candidate.
 *
 * This exists so the pattern is written once. Copied per sweep it drifts, and
 * the failure mode of getting it wrong is silence.
 */
export interface TenantSweepItem {
  id: string;
  tenant_id: string;
  /* drizzle's execute<T> requires an index signature on the row type. */
  [column: string]: unknown;
}

export async function discoverSweepWork(
  database: Database,
  discovery: ReturnType<typeof sql>,
): Promise<TenantSweepItem[]> {
  const result = await database.execute<TenantSweepItem>(discovery);

  return result.rows;
}

/**
 * Runs `work` for each item inside that item's tenant context.
 *
 * One item's failure must not starve the rest, so every item is attempted and
 * the last failure is rethrown afterwards — the caller's timer logs and retries
 * on it. Rethrowing immediately would let a single poisoned row block a shared
 * queue indefinitely.
 */
export async function sweepByTenant<T extends { tenant_id: string }>(
  database: Database,
  items: readonly T[],
  work: (item: T, transaction: DatabaseTransaction) => Promise<unknown>,
): Promise<void> {
  let failure: unknown;

  for (const item of items) {
    try {
      await withTenantContext(database, item.tenant_id, (transaction) => work(item, transaction));
    } catch (error) {
      failure = error;
    }
  }

  if (failure) throw failure;
}
