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

  /**
   * The membership's stored interface locale, defaulted at the database.
   *
   * Carried on the session context rather than left to `GET /me`, because the
   * shell needs the language before it renders anything and a second round
   * trip just to know which words to use would show the wrong ones first.
   */
  locale: string;

  grants: SelfAccessGrant[];
}
