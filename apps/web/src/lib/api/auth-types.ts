export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

export type UserRole = 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';

export type AccessScope = 'tenant' | 'organization' | 'team';

export interface SelfAccessGrant {
  role: UserRole;

  scopeType: AccessScope;

  organizationId: string | null;

  teamId: string | null;
}

export interface SelfAccessContext extends AuthenticatedUser {
  grants: SelfAccessGrant[];
}
