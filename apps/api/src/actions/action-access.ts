import { sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
export function prospectReadScope(auth: AuthenticatedPrincipal, id: SQL, write = false): SQL {
  return sql`EXISTS(SELECT 1 FROM campaign_prospects ap JOIN campaigns ac ON ac.tenant_id=ap.tenant_id AND ac.id=ap.campaign_id
 LEFT JOIN campaign_prospect_assignments aa ON aa.tenant_id=ap.tenant_id AND aa.campaign_prospect_id=ap.id AND aa.ended_at IS NULL
 JOIN user_access_grants g ON g.tenant_id=ap.tenant_id AND g.user_id=${auth.membershipId}
 WHERE ap.tenant_id=${auth.tenantId} AND ap.id=${id} AND (
 (g.scope_type='tenant' AND g.role IN ${write ? sql`('client_admin')` : sql`('client_admin','observer')`}) OR
 (g.scope_type='organization' AND g.organization_id=ac.organization_id AND g.role IN ${write ? sql`('director')` : sql`('director','observer')`}) OR
 (g.scope_type='team' AND g.team_id=aa.team_id AND (g.role='manager' ${write ? sql`` : sql`OR g.role='observer'`} OR (g.role='prospector' AND (aa.assigned_user_id IS NULL OR aa.assigned_user_id=${auth.membershipId}))))))`;
}
