import { createHash } from 'node:crypto';

import { ApiError } from '@/lib/api/api-error';
import type { AuthenticationTokens } from '@/lib/api/auth-types';

import { clearAuthCookies, getRefreshToken, setAuthCookies } from './auth-cookies';
import { backendJson } from './backend-json';

/*
 * Coalesce concurrent refresh attempts inside one
 * Next.js server process.
 *
 * The TrackRoster backend rotates refresh tokens.
 * Without this protection, two simultaneous requests
 * using the same refresh token could race:
 *
 * request A -> refresh succeeds and rotates token
 * request B -> old refresh token is now invalid
 *
 * PostgreSQL/backend session rotation remains the
 * real security authority.
 */
const refreshRequests = new Map<string, Promise<AuthenticationTokens | null>>();

function refreshRequestKey(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

async function requestNewTokens(refreshToken: string): Promise<AuthenticationTokens | null> {
  try {
    return await backendJson<AuthenticationTokens>('/auth/refresh', {
      method: 'POST',

      body: JSON.stringify({
        refreshToken,
      }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      return null;
    }

    throw error;
  }
}

export async function refreshAuthSession(): Promise<AuthenticationTokens | null> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const key = refreshRequestKey(refreshToken);

  let pendingRefresh = refreshRequests.get(key);

  if (!pendingRefresh) {
    pendingRefresh = requestNewTokens(refreshToken).finally(() => {
      refreshRequests.delete(key);
    });

    refreshRequests.set(key, pendingRefresh);
  }

  const tokens = await pendingRefresh;

  if (!tokens) {
    await clearAuthCookies();

    return null;
  }

  /*
   * Every concurrent request writes the same rotated
   * token pair to its own response cookie context.
   */
  await setAuthCookies(tokens);

  return tokens;
}
