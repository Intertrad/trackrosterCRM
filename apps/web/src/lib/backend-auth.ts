import { cookies } from 'next/headers';

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  type AuthenticationTokens,
} from './auth-cookies';

function getApiUrl(): string {
  const apiUrl = process.env.TRACKROSTER_API_URL;

  if (!apiUrl) {
    throw new Error('TRACKROSTER_API_URL is not configured');
  }

  return apiUrl;
}

function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.accessToken === 'string' && typeof candidate.refreshToken === 'string';
}

async function refreshTokens(refreshToken: string): Promise<AuthenticationTokens | null> {
  const response = await fetch(`${getApiUrl()}/auth/refresh`, {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      refreshToken,
    }),

    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const body: unknown = await response.json();

  return isAuthenticationTokens(body) ? body : null;
}

export interface AuthenticatedBackendResult {
  response: Response;

  authenticationFailed: boolean;

  tokensToSet?: AuthenticationTokens;

  shouldClearCookies: boolean;
}

export async function authenticatedBackendFetch(
  path: string,
  init: RequestInit = {},
): Promise<AuthenticatedBackendResult> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  const request = async (token: string): Promise<Response> => {
    const headers = new Headers(init.headers);

    headers.set('authorization', `Bearer ${token}`);

    return fetch(`${getApiUrl()}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  };

  /*
   * Try the current access token first.
   */
  if (accessToken) {
    const response = await request(accessToken);

    if (response.status !== 401) {
      return {
        response,
        authenticationFailed: false,
        shouldClearCookies: false,
      };
    }
  }

  /*
   * Access token is missing/expired.
   * Refresh is impossible without a refresh token.
   */
  if (!refreshToken) {
    return {
      response: new Response(null, {
        status: 401,
      }),

      authenticationFailed: true,

      shouldClearCookies: true,
    };
  }

  const tokens = await refreshTokens(refreshToken);

  if (!tokens) {
    return {
      response: new Response(null, {
        status: 401,
      }),

      authenticationFailed: true,

      shouldClearCookies: true,
    };
  }

  /*
   * Refresh rotation succeeded.
   * Retry the original request exactly once.
   */
  const retryResponse = await request(tokens.accessToken);

  if (retryResponse.status === 401) {
    return {
      response: retryResponse,

      authenticationFailed: true,

      shouldClearCookies: true,
    };
  }

  /*
   * Important:
   *
   * The backend rotated the refresh token, so these
   * new tokens must be written even if the retried
   * domain request returns e.g. 403 or 500.
   */
  return {
    response: retryResponse,

    authenticationFailed: false,

    tokensToSet: tokens,

    shouldClearCookies: false,
  };
}
