import { activeRoster } from '../organization-structure/structure-access.js';
import { sql, type SQL } from 'drizzle-orm';
import { campaignMembers, territoryAssignments } from '../database/schema/participation.js';

// All date ranges are half-open [startsAt, endsAt). Team grants are resolved
// live, so revocation/deactivation does not leave copied per-user permissions.
export function activeParticipationPredicate(
  tenantId: string,
  membershipId: string,
  kind: 'campaign' | 'territory',
): SQL {
  const p = kind === 'campaign' ? campaignMembers : territoryAssignments;
  return sql`${p.tenantId} = ${tenantId} AND ${p.revokedAt} IS NULL
    AND ${p.startsAt} <= CURRENT_TIMESTAMP AND (${p.endsAt} IS NULL OR ${p.endsAt} > CURRENT_TIMESTAMP)
    AND EXISTS (SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id = m.identity_id
      WHERE m.tenant_id = ${tenantId} AND m.id = ${membershipId} AND m.status = 'active' AND i.status = 'active')
    AND (${p.membershipId} = ${membershipId} OR EXISTS (
      SELECT 1 FROM user_access_grants g JOIN teams t ON t.tenant_id = g.tenant_id AND t.id = g.team_id
      JOIN organizations o ON o.tenant_id = t.tenant_id AND o.id = t.organization_id
      WHERE g.tenant_id = ${tenantId} AND g.user_id = ${membershipId} AND g.scope_type = 'team'
      AND g.team_id = ${p.teamId} AND t.status = 'active' AND o.status = 'active')
      OR ${activeRoster(tenantId, membershipId, sql`${p.teamId}`)})`;
}
