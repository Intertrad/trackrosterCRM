import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../database/database.types.js';

/** Serialize access removals per tenant so concurrent requests cannot remove both admins. */
export async function assertAdministratorRemains(
  executor: DatabaseExecutor,
  tenantId: string,
  membershipId: string,
): Promise<void> {
  await executor.execute(sql`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`);
  const result = await executor.execute<{ target_is_admin: boolean; other_admins: number }>(sql`
    WITH active_admins AS (
      SELECT DISTINCT m.id
      FROM tenant_memberships m
      JOIN identities i ON i.id = m.identity_id AND i.status = 'active'
      JOIN user_access_grants g ON g.tenant_id = m.tenant_id AND g.user_id = m.id
      WHERE m.tenant_id = ${tenantId} AND m.status = 'active'
        AND g.role = 'client_admin' AND g.scope_type = 'tenant'
    )
    SELECT EXISTS(SELECT 1 FROM active_admins WHERE id = ${membershipId}) AS target_is_admin,
      (SELECT count(*)::integer FROM active_admins WHERE id <> ${membershipId}) AS other_admins
  `);
  const state = result.rows[0];
  if (!state) throw new Error('Administrator continuity state is unavailable');
  if (state.target_is_admin && state.other_admins === 0) {
    throw new ConflictException(
      'The last active tenant administrator cannot be removed or suspended',
    );
  }
}
