export const TENANT_ROLES = [
  'tenant_admin',
  'director',
  'manager',
  'prospector',
  'auditor',
] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];
export const ROLES = [
  {
    role: 'super_admin',
    description: 'Platform administration; never granted through tenant APIs',
    scope: 'platform',
  },
  { role: 'tenant_admin', description: 'Administration of one workspace', scope: 'tenant' },
  {
    role: 'director',
    description: 'Management within assigned organizations',
    scope: 'organization',
  },
  { role: 'manager', description: 'Management within assigned teams', scope: 'team' },
  { role: 'prospector', description: 'Prospecting within assigned teams and work', scope: 'team' },
  {
    role: 'auditor',
    description: 'Read-only access within explicitly granted scopes',
    scope: 'assigned',
  },
];
export const PERMISSIONS = [
  {
    permission: 'scope.read',
    description: 'Read resources within existing grants',
    configurable: false,
    roles: [...TENANT_ROLES],
  },
  {
    permission: 'memberships.manage',
    description: 'Invite and manage workspace memberships',
    configurable: false,
    roles: ['tenant_admin'],
  },
  {
    permission: 'scopes.manage',
    description: 'Manage role and scope grants',
    configurable: false,
    roles: ['tenant_admin'],
  },
  {
    permission: 'permissions.configure',
    description: 'Configure supported role capabilities',
    configurable: false,
    roles: ['tenant_admin'],
  },
  {
    permission: 'access_history.read',
    description: 'Read membership access history',
    configurable: false,
    roles: ['tenant_admin'],
  },
  {
    permission: 'assignments.manage',
    description: 'Assign, reassign or unassign within management scope',
    configurable: true,
    roles: ['tenant_admin', 'director', 'manager'],
  },
  {
    permission: 'collisions.override',
    description: 'Approve immediate collision overrides within management scope',
    configurable: true,
    roles: ['tenant_admin', 'director', 'manager'],
  },
  {
    permission: 'exports.create',
    description: 'Generate controlled exports within management scope',
    configurable: true,
    roles: ['tenant_admin', 'director', 'manager'],
  },
  {
    permission: 'teams.manage',
    description: 'Update teams within management scope',
    configurable: true,
    roles: ['tenant_admin', 'director', 'manager'],
  },
] as const;
export type ConfigurablePermission =
  'assignments.manage' | 'collisions.override' | 'exports.create' | 'teams.manage';
export const publicRole = (role: string) =>
  role === 'client_admin' ? 'tenant_admin' : role === 'observer' ? 'auditor' : role;
export const internalRole = (role: TenantRole) =>
  role === 'tenant_admin'
    ? ('client_admin' as const)
    : role === 'auditor'
      ? ('observer' as const)
      : role;
