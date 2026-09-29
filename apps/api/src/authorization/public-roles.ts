import type { UserRole } from '../database/schema/user-access-grants.js';

/** Product vocabulary at new API boundaries; stored role names stay migration-compatible. */
export const publicTenantRoles = {
  client_admin: 'tenant_admin',
  director: 'director',
  manager: 'manager',
  prospector: 'prospector',
  observer: 'auditor',
} as const satisfies Record<UserRole, string>;
