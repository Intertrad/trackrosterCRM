export interface AccessTokenPayload {
  sub: string;

  membershipId: string;

  tenantId: string;

  sid: string;

  jti: string;

  ver: 2;

  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;

  membershipId: string;

  sid: string;

  jti: string;

  ver: 2;

  type: 'refresh';
}

export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export interface WorkspaceSelectionChallenge {
  workspaceRequired: true;
  selectionToken: string;
  expiresIn: 300;
  memberships: Array<{
    membershipId: string;
    tenantId: string;
    tenantName: string;
    displayName: string | null;
  }>;
}

export interface MfaLoginChallenge {
  mfaRequired: true;
  challengeToken: string;
  expiresIn: 300;
}
export interface RequiredMfaEnrollment {
  mfaEnrollmentRequired: true;
  challengeToken: string;
  setupKey: string;
  otpauthUri: string;
  expiresIn: number;
}
export type AuthenticationResult =
  AuthenticationTokens | WorkspaceSelectionChallenge | MfaLoginChallenge | RequiredMfaEnrollment;

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

export interface AuthenticatedPrincipal extends AuthenticatedUser {
  identityId: string;

  membershipId: string;

  sessionId: string;

  tokenId: string;
}
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest {
  method?: string;
  routeOptions?: { url?: string };
  headers: {
    authorization?: string;
  };

  auth?: AuthenticatedPrincipal;
}
