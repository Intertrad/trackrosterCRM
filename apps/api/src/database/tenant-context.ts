import { sql } from 'drizzle-orm';
import type { Database, DatabaseTransaction } from './database.types.js';
import { runWithTenantExecutor } from './request-tenant-executor.js';

const TENANT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function setTenantContext(executor: Database | DatabaseTransaction, tenantId: string) {
  if (!TENANT_ID.test(tenantId)) throw new Error('Invalid tenant context');
  await executor.execute(sql`select set_config('trackroster.tenant_id', ${tenantId}, true)`);
}

export async function withTenantContext<T>(
  db: Database,
  tenantId: string,
  work: (tx: DatabaseTransaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await setTenantContext(tx, tenantId);
    return runWithTenantExecutor(tx, () => work(tx));
  });
}
