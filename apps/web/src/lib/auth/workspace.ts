import type { AccessScope, SelfAccessGrant, UserRole } from '@/lib/api/auth-types';
import type { MessageKey } from '@/lib/i18n/dictionary';

export type WorkspaceMode = 'admin' | 'director' | 'manager' | 'prospector' | 'observer';

export interface WorkspaceOption {
  key: string;

  mode: WorkspaceMode;

  role: UserRole;

  scopeType: AccessScope;

  organizationId: string | null;

  teamId: string | null;
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  client_admin: 0,
  director: 1,
  manager: 2,
  prospector: 3,
  observer: 4,
};

const SCOPE_PRIORITY: Record<AccessScope, number> = {
  tenant: 0,
  organization: 1,
  team: 2,
};

export function roleToWorkspaceMode(role: UserRole): WorkspaceMode {
  switch (role) {
    case 'client_admin':
      return 'admin';

    case 'director':
      return 'director';

    case 'manager':
      return 'manager';

    case 'prospector':
      return 'prospector';

    case 'observer':
      return 'observer';
  }
}

export function buildWorkspaceKey(grant: SelfAccessGrant): string {
  return [grant.scopeType, grant.role, grant.organizationId ?? '-', grant.teamId ?? '-'].join(':');
}

export function deriveAvailableWorkspaces(grants: SelfAccessGrant[]): WorkspaceOption[] {
  const workspaces = new Map<string, WorkspaceOption>();

  for (const grant of grants) {
    const key = buildWorkspaceKey(grant);

    workspaces.set(key, {
      key,

      mode: roleToWorkspaceMode(grant.role),

      role: grant.role,

      scopeType: grant.scopeType,

      organizationId: grant.organizationId,

      teamId: grant.teamId,
    });
  }

  return [...workspaces.values()].sort((left, right) => {
    const roleComparison = ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];

    if (roleComparison !== 0) {
      return roleComparison;
    }

    const scopeComparison = SCOPE_PRIORITY[left.scopeType] - SCOPE_PRIORITY[right.scopeType];

    if (scopeComparison !== 0) {
      return scopeComparison;
    }

    const organizationComparison = (left.organizationId ?? '').localeCompare(
      right.organizationId ?? '',
    );

    if (organizationComparison !== 0) {
      return organizationComparison;
    }

    return (left.teamId ?? '').localeCompare(right.teamId ?? '');
  });
}

/** The message key for a role; call sites translate it themselves. */
export function getWorkspaceModeLabelKey(mode: WorkspaceMode): MessageKey {
  switch (mode) {
    case 'admin':
      return 'role.admin';

    case 'director':
      return 'role.director';

    case 'manager':
      return 'role.manager';

    case 'prospector':
      return 'role.prospector';

    case 'observer':
      return 'role.observer';
  }
}

export function getWorkspaceScopeLabel(scopeType: AccessScope): string {
  switch (scopeType) {
    case 'tenant':
      return 'Tenant scope';

    case 'organization':
      return 'Organization scope';

    case 'team':
      return 'Team scope';
  }
}
