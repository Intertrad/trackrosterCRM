import { browserJson } from './browser-json';
import type {
  AuthConfig,
  LoginOutcome,
  MfaEnrollment,
  MfaRecoveryCodes,
  PasswordResetTokenStatus,
} from './auth-types';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

export function getAuthConfig(signal?: AbortSignal): Promise<AuthConfig> {
  return browserJson<AuthConfig>('/api/auth/config', { signal });
}

export function login(email: string, password: string): Promise<LoginOutcome> {
  return browserJson<LoginOutcome>('/api/auth/login', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: email.trim(), password }),
  });
}

export function verifyMfaCode(challengeToken: string, code: string): Promise<LoginOutcome> {
  return browserJson<LoginOutcome>('/api/auth/mfa/verify', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ challengeToken, code }),
  });
}

export function verifyRecoveryCode(challengeToken: string, code: string): Promise<LoginOutcome> {
  /*
   * The backend expects 32 lowercase hex characters. The field is presented
   * in readable groups, so separators are stripped before sending.
   */
  return browserJson<LoginOutcome>('/api/auth/mfa/recovery', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      challengeToken,
      code: code.replace(/[\s-]/g, '').toLowerCase(),
    }),
  });
}

export function selectWorkspace(
  selectionToken: string,
  membershipId: string,
): Promise<LoginOutcome> {
  return browserJson<LoginOutcome>('/api/auth/select-workspace', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ selectionToken, membershipId }),
  });
}

export function requestPasswordReset(email: string): Promise<void> {
  return browserJson<void>('/api/auth/password/forgot', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export function getPasswordResetStatus(
  token: string,
  signal?: AbortSignal,
): Promise<PasswordResetTokenStatus> {
  return browserJson<PasswordResetTokenStatus>(
    `/api/auth/password-reset/${encodeURIComponent(token)}/status`,
    { signal },
  );
}

export function resetPassword(token: string, password: string): Promise<void> {
  return browserJson<void>('/api/auth/password/reset', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token, password }),
  });
}

export function startMfaEnrollment(password: string): Promise<MfaEnrollment> {
  return browserJson<MfaEnrollment>('/api/auth/mfa/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function regenerateRecoveryCodes(password: string, code: string): Promise<MfaRecoveryCodes> {
  return browserJson<MfaRecoveryCodes>('/api/auth/mfa/recovery-codes/regenerate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password, code }),
  });
}

export async function disableMfa(password: string, code: string): Promise<void> {
  await browserJson<undefined>('/api/auth/mfa', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password, code }),
  });
}
