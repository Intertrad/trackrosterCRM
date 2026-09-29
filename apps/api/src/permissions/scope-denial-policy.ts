import { ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
/** Deny wins. Aggregate/compound operations fail closed unless their complete
 * resource footprint can be proven disjoint. Client body/query hints are never proof. */
export async function enforceScopeDenials(
  db: DatabaseExecutor,
  auth: AuthenticatedPrincipal,
  path: string,
  method: string,
  params: Record<string, unknown> = {},
) {
  if (
    /^\/(auth|me|permissions|roles|memberships|membership-scopes|settings\/security)(\/|$)/.test(
      path,
    )
  )
    return;
  const denials =
    await db.execute(sql`SELECT d.* FROM membership_scope_denials d WHERE d.tenant_id=${auth.tenantId} AND d.user_id=${auth.membershipId}
    AND NOT EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=d.tenant_id AND g.user_id=d.user_id AND g.role='client_admin' AND g.scope_type='tenant')`);
  if (!denials.rows.length) return;
  const detail =
    method === 'GET'
      ? /^\/(organizations|teams|campaigns|territories)\/:([A-Za-z]+Id)$/.exec(path)
      : null;
  const resourceId = detail ? params[detail[2]!] : undefined;
  if (!detail || typeof resourceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(resourceId))
    throw new ForbiddenException({
      code: 'SCOPE_DENY_REQUIRES_BOUNDED_RESOURCE',
      message:
        'A scoped deny blocks this aggregate or compound operation; use a permitted resource detail or ask an administrator to revise the deny rule',
    });
  const kind: Record<string, string> = {
    organizations: 'organization',
    teams: 'team',
    campaigns: 'campaign',
    territories: 'territory',
  };
  const targetKind = kind[detail[1]!]!;
  // Expand the actual detail footprint (ancestors and summarized descendants),
  // never all siblings connected through a common organization.
  const overlap = await db.execute(sql`
    WITH RECURSIVE scoped_teams AS (
      SELECT id,organization_id FROM teams WHERE tenant_id=${auth.tenantId}
        AND ((${targetKind}='team' AND id=${resourceId}::uuid)
          OR (${targetKind}='organization' AND organization_id=${resourceId}::uuid)
          OR (${targetKind}='campaign' AND EXISTS(SELECT 1 FROM campaign_prospect_assignments a WHERE a.tenant_id=teams.tenant_id AND a.team_id=teams.id AND a.campaign_id=${resourceId}::uuid AND a.ended_at IS NULL)))
    ), scoped_campaigns AS (
      SELECT id,organization_id FROM campaigns c WHERE tenant_id=${auth.tenantId}
        AND ((${targetKind}='campaign' AND id=${resourceId}::uuid)
          OR (${targetKind}='organization' AND organization_id=${resourceId}::uuid)
          OR (${targetKind} IN ('team','organization') AND EXISTS(SELECT 1 FROM campaign_prospect_assignments a WHERE a.tenant_id=c.tenant_id AND a.campaign_id=c.id AND a.team_id IN(SELECT id FROM scoped_teams) AND a.ended_at IS NULL))
          OR (${targetKind}='territory' AND EXISTS(SELECT 1 FROM campaign_territories ct WHERE ct.tenant_id=c.tenant_id AND ct.campaign_id=c.id AND ct.territory_id=${resourceId}::uuid)))
    ), scoped_territories(id) AS (
      SELECT id FROM territories WHERE tenant_id=${auth.tenantId} AND ${targetKind}='territory' AND id=${resourceId}::uuid
      UNION SELECT territory_id FROM campaign_territories WHERE tenant_id=${auth.tenantId} AND campaign_id IN(SELECT id FROM scoped_campaigns)
    ), territory_ancestors(id,parent_id) AS (
      SELECT t.id,t.parent_id FROM territories t WHERE t.tenant_id=${auth.tenantId} AND t.id IN(SELECT id FROM scoped_territories)
      UNION SELECT t.id,t.parent_id FROM territories t JOIN territory_ancestors a ON t.id=a.parent_id WHERE t.tenant_id=${auth.tenantId}
    ), footprint(kind,id) AS (
      SELECT ${targetKind}::text,${resourceId}::uuid
      UNION SELECT 'team',id FROM scoped_teams
      UNION SELECT 'campaign',id FROM scoped_campaigns
      UNION SELECT 'organization',organization_id FROM scoped_teams
      UNION SELECT 'organization',organization_id FROM scoped_campaigns
      UNION SELECT 'organization',organization_id FROM campaign_organizations WHERE tenant_id=${auth.tenantId} AND campaign_id IN(SELECT id FROM scoped_campaigns) AND ended_at IS NULL
      UNION SELECT 'territory',id FROM territory_ancestors
    ) SELECT 1 FROM membership_scope_denials d WHERE d.tenant_id=${auth.tenantId} AND d.user_id=${auth.membershipId}
      AND (d.scope_type='tenant' OR EXISTS(SELECT 1 FROM footprint f WHERE f.kind=d.scope_type AND f.id=d.resource_id)) LIMIT 1`);
  if (overlap.rows.length)
    throw new ForbiddenException({
      code: 'SCOPE_DENIED',
      message: 'An explicit scope deny overrides resource access',
    });
}
