export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  sid: string;
  jti: string;
  type: 'refresh';
}

export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };

  auth?: AuthenticatedUser;
}
