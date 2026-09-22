import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../database/database.types.js';
export async function assertAssignmentCapacity(
  executor: DatabaseExecutor,
  tenantId: string,
  membershipId: string | null,
  teamId: string,
  prospectId: string,
) {
  if (!membershipId) return;
  await executor.execute(
    sql`SELECT id FROM tenant_memberships WHERE tenant_id = ${tenantId} AND id = ${membershipId} FOR UPDATE`,
  );
  const result = await executor.execute<{
    eligible: boolean;
    capacity: number | null;
    workload: number;
  }>(sql`
    SELECT m.status = 'active' AND i.status = 'active' AND EXISTS (
      SELECT 1 FROM user_access_grants g WHERE g.tenant_id = m.tenant_id AND g.user_id = m.id AND g.team_id = ${teamId} AND g.role = 'prospector'
    ) AS eligible, settings.capacity,
    (SELECT count(*)::integer FROM campaign_prospect_assignments a WHERE a.tenant_id = m.tenant_id AND a.assigned_user_id = m.id AND a.ended_at IS NULL AND a.campaign_prospect_id <> ${prospectId}) AS workload
    FROM tenant_memberships m JOIN identities i ON i.id = m.identity_id
    LEFT JOIN membership_settings settings ON settings.membership_id = m.id AND settings.tenant_id = m.tenant_id
    WHERE m.tenant_id = ${tenantId} AND m.id = ${membershipId}
  `);
  const state = result.rows[0];
  if (!state?.eligible)
    throw new ConflictException('Assigned membership is no longer eligible for this team');
  if (state.capacity !== null && state.workload >= state.capacity)
    throw new ConflictException('Assigned membership has reached capacity');
}
