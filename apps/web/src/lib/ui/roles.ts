import type { UserRole } from '@/lib/api/auth-types';

/*
 * The API exposes product role names at its boundary (client_admin is
 * published as tenant_admin, observer as auditor). These labels follow the
 * design dossier's governance table.
 */
const ROLE_LABELS: Record<string, string> = {
  tenant_admin: 'Tenant Admin',
  client_admin: 'Tenant Admin',
  director: 'Director',
  manager: 'Manager',
  prospector: 'Prospector',
  auditor: 'Observer / Auditor',
  observer: 'Observer / Auditor',
  super_admin: 'Super Administrator',
};

const ROLE_SUMMARIES: Record<string, string> = {
  tenant_admin: 'Full workspace administration access',
  director: 'Organization-wide read access and exports',
  manager: 'Team assignments, approvals and oversight',
  prospector: 'Personal portfolio, actions and follow-ups',
  auditor: 'Read-only evidence within a defined scope',
  super_admin: 'Platform administration without tenant data',
};

const ROLE_PERMISSIONS: Record<string, string> = {
  tenant_admin: 'Users, campaigns, integrations, reports',
  director: 'Objectives, performance, reporting, exports',
  manager: 'Assignments, overrides, team oversight',
  prospector: 'Own prospects, actions, follow-ups, schedule',
  auditor: 'Audit evidence, exports, access reviews',
  super_admin: 'Tenants, plans, platform configuration',
};

function normalize(role: string): string {
  if (role === 'client_admin') return 'tenant_admin';
  if (role === 'observer') return 'auditor';

  return role;
}

export function getRoleLabel(role: UserRole | string): string {
  return ROLE_LABELS[normalize(role)] ?? role;
}

export function getRoleSummary(role: UserRole | string): string | null {
  return ROLE_SUMMARIES[normalize(role)] ?? null;
}

export function getRolePermissionSummary(role: UserRole | string): string | null {
  return ROLE_PERMISSIONS[normalize(role)] ?? null;
}

export function getScopeLabel(scopeType: 'tenant' | 'organization' | 'team'): string {
  switch (scopeType) {
    case 'tenant':
      return 'All regions';
    case 'organization':
      return 'Organization scope';
    case 'team':
      return 'Team scope';
  }
}
