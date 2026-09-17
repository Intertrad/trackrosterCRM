export const USER_ROLES = [
  'client_admin',
  'director',
  'manager',
  'prospector',
  'observer',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ACCESS_SCOPES = ['tenant', 'organization', 'team'] as const;

export type AccessScope = (typeof ACCESS_SCOPES)[number];

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

export interface AccessGrant {
  role: UserRole;
  scopeType: AccessScope;
  organizationId: string | null;
  teamId: string | null;
}

export interface SelfAccessResponse extends AuthenticatedUser {
  grants: AccessGrant[];
}

export type WorkspaceMode = 'admin' | 'director' | 'manager' | 'prospector' | 'observer';

export interface WorkspaceOption {
  key: string;
  mode: WorkspaceMode;
  role: UserRole;
  scopeType: AccessScope;
  organizationId: string | null;
  teamId: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
