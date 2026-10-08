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
  platformAdmin?: boolean;
  email: string;

  displayName: string | null;

  /** Stored on the membership; drives both wording and date formatting. */
  locale: string;

  grants: SelfAccessGrant[];
}

/*
 * POST /auth/login and POST /auth/mfa/{verify,recovery} return one of four
 * shapes. Treating the result as tokens unconditionally writes empty session
 * cookies, so every caller must discriminate before trusting it.
 */
export interface WorkspaceSelectionChallenge {
  workspaceRequired: true;
  selectionToken: string;
  expiresIn: number;
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
  expiresIn: number;
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

export function isAuthenticationTokens(
  result: AuthenticationResult,
): result is AuthenticationTokens {
  return (
    typeof (result as AuthenticationTokens).accessToken === 'string' &&
    typeof (result as AuthenticationTokens).refreshToken === 'string'
  );
}

export function isWorkspaceSelectionChallenge(
  result: AuthenticationResult,
): result is WorkspaceSelectionChallenge {
  return (result as WorkspaceSelectionChallenge).workspaceRequired === true;
}

export function isMfaLoginChallenge(result: AuthenticationResult): result is MfaLoginChallenge {
  return (result as MfaLoginChallenge).mfaRequired === true;
}

export function isRequiredMfaEnrollment(
  result: AuthenticationResult,
): result is RequiredMfaEnrollment {
  return (result as RequiredMfaEnrollment).mfaEnrollmentRequired === true;
}

/*
 * What the BFF hands the browser after a login attempt. Tokens never
 * cross this boundary — only the next step the UI must render.
 */
export type LoginOutcome =
  | { next: 'authenticated' }
  | { next: 'mfa'; challengeToken: string; expiresIn: number }
  | {
      next: 'mfa_enrollment';
      challengeToken: string;
      setupKey: string;
      otpauthUri: string;
      expiresIn: number;
    }
  | {
      next: 'workspace';
      selectionToken: string;
      expiresIn: number;
      memberships: WorkspaceSelectionChallenge['memberships'];
    };

/** GET /auth/config — drives which sign-in methods the UI may offer. */
export interface AuthConfig {
  password: boolean;
  mfa: {
    totp: boolean;
    recoveryCodes: boolean;
  };
  passwordRecovery: boolean;
  sso: {
    enabled: boolean;
    providers?: string[];
  };
}

export interface PasswordResetTokenStatus {
  valid: boolean;
  expiresAt?: string;
}

export interface InvitationPreview {
  workspaceName: string;
  emailHint: string;
  expiresAt: string;
  existingAccount: boolean;
  mfaRequired: boolean;
  platformRole?: 'super_admin' | 'support_operator' | null;
}

export interface InvitationAcceptance {
  accepted: true;
  membershipId: string;
  signInRequired: true;
}

/**
 * POST /auth/mfa/enroll
 *
 * Short-lived: the challenge expires in `expiresIn` seconds and the secret is
 * single-use. It is never persisted anywhere in the browser.
 */
export interface MfaEnrollment {
  challengeToken: string;

  /** Base32 secret for manual entry when a QR code cannot be scanned. */
  setupKey: string;

  otpauthUri: string;

  expiresIn: number;
}

export interface MfaRecoveryCodes {
  recoveryCodes: string[];
}
