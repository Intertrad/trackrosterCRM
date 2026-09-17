import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  type AuthenticationTokens,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from '@/lib/auth-cookies';

interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Record<string, unknown>;

  return typeof user.userId === 'string' && typeof user.tenantId === 'string';
}

function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tokens = value as Record<string, unknown>;

  return typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string';
}

async function fetchCurrentUser(apiUrl: string, accessToken: string) {
  return fetch(`${apiUrl}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
}

export async function GET(request: NextRequest) {
  const apiUrl = process.env.TRACKROSTER_API_URL;

  if (!apiUrl) {
    console.error('TRACKROSTER_API_URL is not configured');

    return NextResponse.json(
      {
        message: 'Authentication service is not configured.',
      },
      {
        status: 500,
      },
    );
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return NextResponse.json(
      {
        message: 'Unauthenticated.',
      },
      {
        status: 401,
      },
    );
  }

  try {
    /*
     * 1. Try the current access token first.
     */
    if (accessToken) {
      const backendResponse = await fetchCurrentUser(apiUrl, accessToken);

      if (backendResponse.ok) {
        const user: unknown = await backendResponse.json();

        if (!isAuthenticatedUser(user)) {
          console.error('TrackRoster API returned an invalid /auth/me response');

          return NextResponse.json(
            {
              message: 'Authentication service returned an invalid response.',
            },
            {
              status: 502,
            },
          );
        }

        return NextResponse.json(user);
      }

      /*
       * Only authentication failure triggers refresh.
       *
       * Do not refresh because of arbitrary backend errors.
       */
      if (backendResponse.status !== 401) {
        console.error(`TrackRoster API /auth/me failed with status ${backendResponse.status}`);

        return NextResponse.json(
          {
            message: 'Authentication service is unavailable.',
          },
          {
            status: 502,
          },
        );
      }
    }

    /*
     * 2. Access token is missing/expired.
     *    We need a refresh token.
     */
    if (!refreshToken) {
      const response = NextResponse.json(
        {
          message: 'Unauthenticated.',
        },
        {
          status: 401,
        },
      );

      clearAuthCookies(response);

      return response;
    }

    /*
     * 3. Ask NestJS to atomically rotate the refresh token.
     */
    const refreshResponse = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken,
      }),
      cache: 'no-store',
    });

    if (refreshResponse.status === 401) {
      const response = NextResponse.json(
        {
          message: 'Unauthenticated.',
        },
        {
          status: 401,
        },
      );

      clearAuthCookies(response);

      return response;
    }

    if (!refreshResponse.ok) {
      console.error(`TrackRoster API refresh failed with status ${refreshResponse.status}`);

      return NextResponse.json(
        {
          message: 'Authentication service is unavailable.',
        },
        {
          status: 502,
        },
      );
    }

    const tokens: unknown = await refreshResponse.json();

    if (!isAuthenticationTokens(tokens)) {
      console.error('TrackRoster API returned an invalid refresh response');

      return NextResponse.json(
        {
          message: 'Authentication service returned an invalid response.',
        },
        {
          status: 502,
        },
      );
    }

    /*
     * 4. Retry /auth/me exactly once with the new access token.
     */
    const retryResponse = await fetchCurrentUser(apiUrl, tokens.accessToken);

    if (retryResponse.status === 401) {
      const response = NextResponse.json(
        {
          message: 'Unauthenticated.',
        },
        {
          status: 401,
        },
      );

      clearAuthCookies(response);

      return response;
    }

    if (!retryResponse.ok) {
      console.error(`TrackRoster API /auth/me retry failed with status ${retryResponse.status}`);

      return NextResponse.json(
        {
          message: 'Authentication service is unavailable.',
        },
        {
          status: 502,
        },
      );
    }

    const user: unknown = await retryResponse.json();

    if (!isAuthenticatedUser(user)) {
      console.error('TrackRoster API returned an invalid /auth/me response after refresh');

      return NextResponse.json(
        {
          message: 'Authentication service returned an invalid response.',
        },
        {
          status: 502,
        },
      );
    }

    /*
     * 5. Browser receives the user context plus newly rotated cookies.
     */
    const response = NextResponse.json(user);

    setAuthCookies(response, tokens);

    return response;
  } catch (error) {
    console.error('Unable to reach TrackRoster authentication API', error);

    return NextResponse.json(
      {
        message: 'Authentication service is unavailable.',
      },
      {
        status: 502,
      },
    );
  }
}
