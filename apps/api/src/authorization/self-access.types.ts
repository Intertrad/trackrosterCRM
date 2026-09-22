import type { AccessScope, UserRole } from '../database/schema/user-access-grants.js';

export interface SelfAccessGrant {
  role: UserRole;

  scopeType: AccessScope;

  organizationId: string | null;

  teamId: string | null;
}

export interface SelfAccessContext {
  userId: string;

  tenantId: string;

  email: string;

  displayName: string | null;

  grants: SelfAccessGrant[];
}
