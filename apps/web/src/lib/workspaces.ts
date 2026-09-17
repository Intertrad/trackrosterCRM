import type { AccessGrant, UserRole, WorkspaceMode, WorkspaceOption } from '@/lib/auth-types';

const ROLE_ORDER: Record<UserRole, number> = {
  client_admin: 0,
  director: 1,
  manager: 2,
  prospector: 3,
  observer: 4,
};

function getWorkspaceMode(role: UserRole): WorkspaceMode {
  if (role === 'client_admin') {
    return 'admin';
  }

  return role;
}

function createWorkspaceKey(grant: AccessGrant): string {
  return [grant.role, grant.scopeType, grant.organizationId ?? 'none', grant.teamId ?? 'none'].join(
    ':',
  );
}

export function deriveAvailableWorkspaces(grants: AccessGrant[]): WorkspaceOption[] {
  const workspaces = grants.map((grant): WorkspaceOption => ({
    key: createWorkspaceKey(grant),
    mode: getWorkspaceMode(grant.role),
    role: grant.role,
    scopeType: grant.scopeType,
    organizationId: grant.organizationId,
    teamId: grant.teamId,
  }));

  const uniqueWorkspaces = Array.from(
    new Map(workspaces.map((workspace) => [workspace.key, workspace])).values(),
  );

  return uniqueWorkspaces.sort((a, b) => {
    const roleDifference = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];

    if (roleDifference !== 0) {
      return roleDifference;
    }

    return a.key.localeCompare(b.key);
  });
}

export function getWorkspacePreferenceKey(userId: string, tenantId: string): string {
  return `trackroster:workspace:${tenantId}:${userId}`;
}
