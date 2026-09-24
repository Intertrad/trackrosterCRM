export const TENANT_ROLES = [
  'tenant_admin',
  'director',
  'manager',
  'prospector',
  'auditor',
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export interface RoleDescriptor {
  role: string;
  description: string;
  scope: string;
}

export interface RoleCatalogue {
  items: RoleDescriptor[];
}

export interface PermissionDescriptor {
  permission: string;
  description: string;
  configurable: boolean;
  roles: string[];
}

export interface PermissionCatalogue {
  items: PermissionDescriptor[];
}

/**
 * GET /roles/:role/permissions
 *
 * `permissions` is the effective set; `configurablePermissions` is the subset
 * an administrator is allowed to toggle. tenant_admin and super_admin come
 * back with `configurable: false` — the API refuses to change either, so the
 * editor must render them read-only rather than failing on save.
 */
export interface RolePermissions {
  role: string;
  scope?: string;
  configurable: boolean;
  permissions: string[];
  configurablePermissions?: string[];
  updatedAt: string | null;
  message?: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  tenant_admin: 'Admin',
  director: 'Director',
  manager: 'Manager',
  prospector: 'Prospector',
  auditor: 'Auditor',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

export function permissionLabel(permission: string): string {
  const words = permission.replace(/[._]/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Groups "prospects.read" and "prospects.write" under "prospects". */
export function permissionGroup(permission: string): string {
  const [head] = permission.split('.');

  return head ?? permission;
}
