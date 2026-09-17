import { NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_TOKEN_COOKIE,
  type AuthenticationTokens,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from '@/lib/auth-cookies';

type UserRole = 'client_admin' | 'director' | 'manager' | 'prospector' | 'observer';

type AccessScope = 'tenant' | 'organization' | 'team';

interface AccessGrant {
  role: UserRole;
  scopeType: AccessScope;
  organizationId: string | null;
  teamId: string | null;
}

interface SelfAccessResponse {
  userId: string;
  tenantId: string;
  grants: AccessGrant[];
}

function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tokens = value as Record<string, unknown>;

  return typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string';
}

function isAccessGrant(value: unknown): value is AccessGrant {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const grant = value as Record<string, unknown>;

  const validRoles = ['client_admin', 'director', 'manager', 'prospector', 'observer'];

  const validScopes = ['tenant', 'organization', 'team'];

  return (
    typeof grant.role === 'string' &&
    validRoles.includes(grant.role) &&
    typeof grant.scopeType === 'string' &&
    validScopes.includes(grant.scopeType) &&
    (grant.organizationId === null || typeof grant.organizationId === 'string') &&
    (grant.teamId === null || typeof grant.teamId === 'string')
  );
}

function isSelfAccessResponse(value: unknown): value is SelfAccessResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    typeof response.userId === 'string' &&
    typeof response.tenantId === 'string' &&
    Array.isArray(response.grants) &&
    response.grants.every(isAccessGrant)
  );
}

async function fetchAccessGrants(apiUrl: string, accessToken: string) {
  return fetch(`${apiUrl}/auth/me/access-grants`, {
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
     * 1. Try existing access token.
     */
    if (accessToken) {
      const backendResponse = await fetchAccessGrants(apiUrl, accessToken);

      if (backendResponse.ok) {
        const data: unknown = await backendResponse.json();

        if (!isSelfAccessResponse(data)) {
          console.error('Invalid access-grants response');

          return NextResponse.json(
            {
              message: 'Authentication service returned an invalid response.',
            },
            {
              status: 502,
            },
          );
        }

        return NextResponse.json(data);
      }

      /*
       * Refresh only for a genuine 401.
       */
      if (backendResponse.status !== 401) {
        console.error(`Access-grants API failed with status ${backendResponse.status}`);

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
     * 2. Cannot refresh without refresh token.
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
     * 3. Rotate refresh token through NestJS.
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
      console.error(`Refresh failed with status ${refreshResponse.status}`);

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
      console.error('Invalid authentication refresh response');

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
     * 4. Retry exactly once with the new access token.
     */
    const retryResponse = await fetchAccessGrants(apiUrl, tokens.accessToken);

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
      console.error(`Access-grants retry failed with status ${retryResponse.status}`);

      return NextResponse.json(
        {
          message: 'Authentication service is unavailable.',
        },
        {
          status: 502,
        },
      );
    }

    const data: unknown = await retryResponse.json();

    if (!isSelfAccessResponse(data)) {
      console.error('Invalid access-grants response after refresh');

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
     * 5. Return grants and update rotated cookies.
     */
    const response = NextResponse.json(data);

    setAuthCookies(response, tokens);

    return response;
  } catch (error) {
    console.error('Unable to reach TrackRoster access-grants API', error);

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
