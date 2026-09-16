import { cookies } from 'next/headers';

import { backendFetch, type AuthenticationTokens } from '@/lib/api/backend';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, sessionCookieOptions } from './session-cookies';

export async function refreshSession(): Promise<AuthenticationTokens | null> {
  const cookieStore = await cookies();

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  const response = await backendFetch('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const tokens = (await response.json()) as AuthenticationTokens;

  if (!tokens.accessToken || !tokens.refreshToken) {
    return null;
  }

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, sessionCookieOptions);

  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, sessionCookieOptions);

  return tokens;
}
