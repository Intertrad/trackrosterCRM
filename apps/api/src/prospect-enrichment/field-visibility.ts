import { sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { customFieldDefinitions as fields } from '../database/schema/index.js';
export function visibleField(a: AuthenticatedPrincipal) {
  return sql`(NOT (${fields.visibility} ? 'roles') OR EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=${a.tenantId} AND g.user_id=${a.membershipId} AND (g.role='client_admin' OR (${fields.visibility}->'roles') ? CASE g.role::text WHEN 'observer' THEN 'auditor' ELSE g.role::text END)))`;
}
