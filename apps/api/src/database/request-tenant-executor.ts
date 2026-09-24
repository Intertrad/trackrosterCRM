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

export function createRequestAwareDatabase(database: Database): Database {
  return new Proxy(database, {
    get(target, property, receiver) {
      const active = storage.getStore();
      return Reflect.get(active ?? target, property, receiver);
    },
  });
}
