import { ForbiddenException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
/** Restrictions on existing authority; these capabilities never create resource access. */
export const DOMAIN_PERMISSIONS = [
  'campaigns.read',
  'campaigns.manage',
  'territories.read',
  'territories.manage',
  'organizations.read',
  'organizations.manage',
  'prospects.read',
  'prospects.manage',
  'activities.read',
  'activities.manage',
  'follow_ups.read',
  'follow_ups.manage',
  'consents.read',
  'consents.manage',
  'routes.read',
  'routes.manage',
  'objectives.read',
  'objectives.manage',
  'reports.read',
  'imports.manage',
  'notifications.read',
  'notifications.manage',
  'reservations.manage',
  'allocation.manage',
] as const;
export type DomainPermission = (typeof DOMAIN_PERMISSIONS)[number];
export function requestDomainPermission(
  path: string,
  method: string,
): DomainPermission | undefined {
  if (/^\/map\//.test(path)) return 'reports.read';
  const read = method === 'GET' || method === 'HEAD';
  if (/^\/(dashboard|manager\/dashboard|prospector\/today)(\/|$)/.test(path)) return 'reports.read';
  if (/^\/(imports|import-issues)(\/|$)/.test(path)) return 'imports.manage';
  if (
    /^\/(assignment-rules|assignment-suggestions)(\/|$)/.test(path) ||
    path.includes('/geographic-allocation')
  )
    return 'allocation.manage';
  if (/^\/notifications(\/|$)/.test(path))
    return read ? 'notifications.read' : 'notifications.manage';
  if (/^\/(routes|route-stops)(\/|$)/.test(path)) return read ? 'routes.read' : 'routes.manage';
  if (/^\/objectives(\/|$)/.test(path)) return read ? 'objectives.read' : 'objectives.manage';
  if (/\/consents(\/|$)/.test(path)) return read ? 'consents.read' : 'consents.manage';
  if (/\/follow-ups(\/|$)/.test(path)) return read ? 'follow_ups.read' : 'follow_ups.manage';
  if (/^\/actions(\/|$)/.test(path) || /\/(activities|timeline)(\/|$)/.test(path))
    return read ? 'activities.read' : 'activities.manage';
  if (/^\/(reservations|reservation-rules)(\/|$)/.test(path) || /\/reservation(\/|$)/.test(path))
    return 'reservations.manage';
  if (
    /^\/(territories|territory-assignments|regions)(\/|$)/.test(path) ||
    /\/territories(\/|$)/.test(path)
  )
    return read ? 'territories.read' : 'territories.manage';
  if (/^\/(organizations|organization-relationships|teams)(\/|$)/.test(path))
    return read ? 'organizations.read' : 'organizations.manage';
  if (/^\/(establishments|prospects|work-queue)(\/|$)/.test(path) || /\/prospects(\/|$)/.test(path))
    return read ? 'prospects.read' : 'prospects.manage';
  if (/^\/(campaigns|campaign-members)(\/|$)/.test(path))
    return read ? 'campaigns.read' : 'campaigns.manage';
  return undefined;
}

export async function enforceDomainRestriction(
  db: DatabaseExecutor,
  auth: AuthenticatedPrincipal,
  permission: DomainPermission,
) {
  const restricted = await db.execute(sql`
        SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=${auth.tenantId}
        AND NOT (p.permissions ? ${permission})
        AND EXISTS (SELECT 1 FROM (SELECT tenant_id,user_id,role FROM user_access_grants UNION ALL SELECT tenant_id,user_id,role FROM membership_resource_scopes) g WHERE g.tenant_id=p.tenant_id AND g.user_id=${auth.membershipId}
          AND CASE g.role::text WHEN 'observer' THEN 'auditor' WHEN 'client_admin' THEN 'tenant_admin' ELSE g.role::text END=p.role)
        AND NOT EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id=p.tenant_id AND g.user_id=${auth.membershipId} AND g.role='client_admin' AND g.scope_type='tenant')
        LIMIT 1`);
  if (restricted.rows.length)
    throw new ForbiddenException(`Permission ${permission} is restricted for this membership`);
}
