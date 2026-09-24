import type { Pool, PoolClient } from 'pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Runs worker database work on one client with a transaction-local tenant
 * setting. RLS policies can therefore be enabled without relying on a pooled
 * session retaining a previous job's tenant.
 */
export async function withWorkerTenantTransaction<T>(
  pool: Pick<Pool, 'connect'>,
  tenantId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!UUID.test(tenantId)) throw new Error('Invalid tenant context');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('trackroster.tenant_id', $1, true)", [tenantId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
