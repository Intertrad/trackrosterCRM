import { sql, type SQL } from 'drizzle-orm';
// Embeddable predicates keep roster-derived read access separate from role grants.
export function activeRoster(tenantId: string, membershipId: string, teamId: SQL): SQL {
  return sql`EXISTS (SELECT 1 FROM team_memberships roster
    JOIN teams rt ON rt.tenant_id = roster.tenant_id AND rt.id = roster.team_id
    JOIN organizations ro ON ro.tenant_id = rt.tenant_id AND ro.id = rt.organization_id
    JOIN tenant_memberships rm ON rm.tenant_id = roster.tenant_id AND rm.id = roster.membership_id
    JOIN identities ri ON ri.id = rm.identity_id
    WHERE roster.tenant_id = ${tenantId} AND roster.membership_id = ${membershipId} AND roster.team_id = ${teamId}
      AND roster.revoked_at IS NULL AND roster.starts_at <= CURRENT_TIMESTAMP AND (roster.ends_at IS NULL OR roster.ends_at > CURRENT_TIMESTAMP)
      AND rt.status = 'active' AND ro.status = 'active' AND rm.status = 'active' AND ri.status = 'active')`;
}
export function organizationRead(tenantId: string, membershipId: string, organizationId: SQL): SQL {
  return sql`EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = ${tenantId} AND g.user_id = ${membershipId}
    AND (g.scope_type = 'tenant' OR g.organization_id = ${organizationId}))`;
}
export function teamRead(
  tenantId: string,
  membershipId: string,
  teamId: SQL,
  organizationId: SQL,
): SQL {
  return sql`(EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = ${tenantId} AND g.user_id = ${membershipId}
    AND (g.scope_type = 'tenant' OR (g.scope_type = 'organization' AND g.organization_id = ${organizationId}) OR (g.scope_type = 'team' AND g.team_id = ${teamId})))
    OR ${activeRoster(tenantId, membershipId, teamId)})`;
}
