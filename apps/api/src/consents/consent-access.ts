import { sql, type SQL } from 'drizzle-orm';
// Only explicit operational grants confer access to consent evidence.
export function consentAccess(
  tenantId: string,
  membershipId: string,
  prospectId: string | SQL,
  write = false,
) {
  return sql`EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=${tenantId} AND g.user_id=${membershipId}
 AND ((g.scope_type='tenant' AND g.role IN ${write ? sql`('client_admin')` : sql`('client_admin','observer')`}) OR EXISTS(
 SELECT 1 FROM campaign_prospects cp JOIN campaigns c ON c.tenant_id=cp.tenant_id AND c.id=cp.campaign_id
 LEFT JOIN campaign_prospect_assignments a ON a.tenant_id=cp.tenant_id AND a.campaign_prospect_id=cp.id AND a.ended_at IS NULL
 WHERE cp.tenant_id=${tenantId} AND cp.establishment_id=${prospectId}
 AND ((g.scope_type='organization' AND g.organization_id=c.organization_id AND g.role IN ${write ? sql`('director')` : sql`('director','observer')`})
 OR (g.scope_type='team' AND g.team_id=a.team_id AND (g.role='manager' OR (g.role='prospector' AND (a.assigned_user_id IS NULL OR a.assigned_user_id=${membershipId}))))))))`;
}
