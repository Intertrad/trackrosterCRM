import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { establishments, tenants } from '../database/schema/index.js';
import { consentAccess } from '../consents/consent-access.js';
import { prospectReadScope } from '../actions/action-access.js';
import {
  enforceDomainRestriction,
  type DomainPermission,
} from '../permissions/domain-permissions.js';
import { enforceScopeDenials } from '../permissions/scope-denial-policy.js';
export function masterAccess(a: AuthenticatedPrincipal, id: SQL, write = false) {
  const admin = sql`EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND g.role='client_admin' AND g.scope_type='tenant')`;
  return write
    ? sql`(${admin} OR (EXISTS(SELECT 1 FROM campaign_prospects p WHERE p.tenant_id=${a.tenantId} AND p.establishment_id=${id}) AND NOT EXISTS(SELECT 1 FROM campaign_prospects p WHERE p.tenant_id=${a.tenantId} AND p.establishment_id=${id} AND NOT (${prospectReadScope(a, sql`p.id`, true)}))))`
    : consentAccess(a.tenantId, a.membershipId, id);
}
@Injectable()
export class ProspectAccessService {
  constructor(@Inject(DATABASE) readonly db: Database) {}
  async lock(
    a: AuthenticatedPrincipal,
    tx: DatabaseExecutor,
    permission: DomainPermission = 'prospects.manage',
  ) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('update');
    const active = await tx.execute(
      sql`SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id JOIN tenants t ON t.id=m.tenant_id WHERE m.id=${a.membershipId} AND m.tenant_id=${a.tenantId} AND m.status='active' AND i.status='active' AND t.status='active'`,
    );
    if (!active.rows.length) throw new ForbiddenException('Active membership required');
    await enforceScopeDenials(tx, a, '/prospects', 'POST');
    await enforceDomainRestriction(tx, a, permission);
  }
  async admin(a: AuthenticatedPrincipal, tx: DatabaseExecutor = this.db) {
    const r = await tx.execute(
      sql`SELECT 1 FROM user_access_grants WHERE tenant_id=${a.tenantId} AND user_id=${a.membershipId} AND role='client_admin' AND scope_type='tenant'`,
    );
    if (!r.rows.length) throw new ForbiddenException('Tenant administrator required');
  }
  async prospect(
    a: AuthenticatedPrincipal,
    id: string,
    write = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const [r] = await tx
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, a.tenantId),
          eq(establishments.id, id),
          masterAccess(a, sql`${id}::uuid`, write),
        ),
      );
    if (!r) throw new NotFoundException('Prospect not found');
    const { location: _location, ...result } = r;
    void _location;
    return result;
  }
}
