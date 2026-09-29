import { sql, type SQL } from 'drizzle-orm';
import { activeRoster } from '../organization-structure/structure-access.js';
// The caller joins campaign_organizations as co. Never derive manage/operational authority.
export function campaignOrganizationAccess(
  tenantId: string,
  membershipId: string,
  level: 'read' | 'read_write' = 'read',
): SQL {
  return sql`co.tenant_id = ${tenantId} AND co.ended_at IS NULL
    AND EXISTS (SELECT 1 FROM organizations o WHERE o.tenant_id = co.tenant_id AND o.id = co.organization_id AND o.status = 'active')
    AND EXISTS (SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id = m.identity_id WHERE m.tenant_id = ${tenantId} AND m.id = ${membershipId} AND m.status = 'active' AND i.status = 'active')
    AND (${
      level === 'read_write'
        ? sql`co.access_mode = 'participate' AND EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = co.tenant_id AND g.user_id = ${membershipId} AND g.scope_type = 'organization' AND g.organization_id = co.organization_id AND g.role = 'director')`
        : sql`
      EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = co.tenant_id AND g.user_id = ${membershipId} AND g.organization_id = co.organization_id
        AND (g.scope_type = 'organization' OR (g.scope_type = 'team' AND EXISTS (SELECT 1 FROM teams t WHERE t.tenant_id = co.tenant_id AND t.id = g.team_id AND t.organization_id = co.organization_id AND t.status = 'active'))))
      OR EXISTS (SELECT 1 FROM teams ot WHERE ot.tenant_id = co.tenant_id AND ot.organization_id = co.organization_id AND ${activeRoster(tenantId, membershipId, sql`ot.id`)})`
    })`;
}
