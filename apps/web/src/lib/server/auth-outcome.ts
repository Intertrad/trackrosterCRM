import {
  type AuthenticationResult,
  type LoginOutcome,
  isAuthenticationTokens,
  isMfaLoginChallenge,
  isRequiredMfaEnrollment,
  isWorkspaceSelectionChallenge,
} from '@/lib/api/auth-types';
import { setAuthCookies } from './auth-cookies';

/*
 * Converts a backend authentication result into the next UI step and, when
 * the result really is a token pair, installs the httpOnly session cookies.
 *
 * Tokens, selection tokens and challenge tokens differ in sensitivity:
 * access/refresh tokens never leave this module, while short-lived
 * challenge tokens must reach the browser so the next screen can complete
 * the flow.
 */
export async function resolveAuthenticationOutcome(
  result: AuthenticationResult,
): Promise<LoginOutcome> {
  if (isAuthenticationTokens(result)) {
    await setAuthCookies(result);

    return { next: 'authenticated' };
  }

  if (isMfaLoginChallenge(result)) {
    return {
      next: 'mfa',
      challengeToken: result.challengeToken,
      expiresIn: result.expiresIn,
    };
  }

  if (isRequiredMfaEnrollment(result)) {
    return {
      next: 'mfa_enrollment',
      challengeToken: result.challengeToken,
      setupKey: result.setupKey,
      otpauthUri: result.otpauthUri,
      expiresIn: result.expiresIn,
    };
  }

  if (isWorkspaceSelectionChallenge(result)) {
    return {
      next: 'workspace',
      selectionToken: result.selectionToken,
      expiresIn: result.expiresIn,
      memberships: result.memberships,
    };
  }

  throw new Error('Unrecognized authentication result');
}
