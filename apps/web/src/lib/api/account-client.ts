import type {
  AccountMembership,
  AccountPreferences,
  AccountProfile,
  AccountSessionPage,
  UpdateAccountInput,
  UpdatePreferencesInput,
  Versioned,
} from './account-types';
import type { LoginOutcome } from './auth-types';
import { browserJson } from './browser-json';
import { browserResource } from './browser-resource';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

export async function getAccountProfile(signal?: AbortSignal): Promise<Versioned<AccountProfile>> {
  return browserResource<AccountProfile>('/api/me', { signal, cache: 'no-store' });
}

export async function updateAccountProfile(
  input: UpdateAccountInput,
  etag: string | null,
): Promise<Versioned<AccountProfile>> {
  return browserResource<AccountProfile>('/api/me', {
    method: 'PATCH',
    headers: conditionalHeaders(etag),
    body: JSON.stringify(input),
  });
}

export async function getAccountPreferences(
  signal?: AbortSignal,
): Promise<Versioned<AccountPreferences>> {
  return browserResource<AccountPreferences>('/api/me/preferences', {
    signal,
    cache: 'no-store',
  });
}

export async function updateAccountPreferences(
  input: UpdatePreferencesInput,
  etag: string | null,
): Promise<Versioned<AccountPreferences>> {
  return browserResource<AccountPreferences>('/api/me/preferences', {
    method: 'PATCH',
    headers: conditionalHeaders(etag),
    body: JSON.stringify(input),
  });
}

export function getAccountMemberships(signal?: AbortSignal): Promise<AccountMembership[]> {
  return browserJson<AccountMembership[]>('/api/me/memberships', {
    signal,
    cache: 'no-store',
  });
}

export function getAccountSessions(signal?: AbortSignal): Promise<AccountSessionPage> {
  return browserJson<AccountSessionPage>('/api/me/sessions', { signal, cache: 'no-store' });
}

export function revokeSession(sessionId: string): Promise<{ revoked: number }> {
  return browserJson<{ revoked: number }>(`/api/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: idempotencyHeaders(),
  });
}

export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return browserJson<{ revoked: number }>('/api/me/sessions/others', {
    method: 'DELETE',
    headers: idempotencyHeaders(),
  });
}

export function switchActiveMembership(membershipId: string): Promise<LoginOutcome> {
  return browserJson<LoginOutcome>('/api/me/active-membership', {
    method: 'POST',
    headers: { ...JSON_HEADERS, ...idempotencyHeaders() },
    body: JSON.stringify({ membershipId }),
  });
}

/*
 * A write carries the validator read with the resource, so a change made in
 * another tab or session is rejected with 412 instead of being overwritten.
 */
function conditionalHeaders(etag: string | null): Record<string, string> {
  const headers: Record<string, string> = { ...JSON_HEADERS, ...idempotencyHeaders() };

  if (etag) {
    headers['if-match'] = etag;
  }

  return headers;
}

function idempotencyHeaders(): Record<string, string> {
  return { 'idempotency-key': crypto.randomUUID() };
}
