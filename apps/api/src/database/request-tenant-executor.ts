import { AsyncLocalStorage } from 'node:async_hooks';
import type { Database, DatabaseTransaction } from './database.types.js';

const storage = new AsyncLocalStorage<Database | DatabaseTransaction>();

export function runWithTenantExecutor<T>(
  executor: Database | DatabaseTransaction,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(executor, work);
}

export function currentTenantExecutor(): Database | DatabaseTransaction | undefined {
  return storage.getStore();
}

/**
 * Escape the request transaction for a deliberately independent write.
 *
 * External leases (Redis, provider calls, etc.) cannot be made atomic with the
 * request transaction. Reservation intent uses this boundary so its durable
 * record commits even when the handler later returns an uncertain result.
 */
export function runWithoutTenantExecutor<T>(work: () => Promise<T>): Promise<T> {
  return storage.run(undefined as unknown as Database, work);
}

export function createRequestAwareDatabase(database: Database): Database {
  return new Proxy(database, {
    get(target, property, receiver) {
      const active = storage.getStore();
      return Reflect.get(active ?? target, property, receiver);
    },
  });
}
