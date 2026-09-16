import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { backendFetch, forwardBackendResponse } from '@/lib/api/backend';
import { refreshSession } from '@/lib/auth/refresh-session';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/session-cookies';

async function fetchCurrentUser(accessToken: string): Promise<Response> {
  return backendFetch('/auth/me', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
}

async function clearSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

export async function GET(): Promise<Response> {
  try {
    const cookieStore = await cookies();

    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

    if (accessToken) {
      const response = await fetchCurrentUser(accessToken);

      if (response.ok) {
        return forwardBackendResponse(response);
      }

      if (response.status !== 401) {
        return forwardBackendResponse(response);
      }
    }

    const refreshedTokens = await refreshSession();

    if (!refreshedTokens) {
      await clearSession();

      return NextResponse.json(
        {
          message: 'Authentication required',
        },
        {
          status: 401,
        },
      );
    }

    const retryResponse = await fetchCurrentUser(refreshedTokens.accessToken);

    if (!retryResponse.ok && retryResponse.status === 401) {
      await clearSession();
    }

    return forwardBackendResponse(retryResponse);
  } catch {
    return NextResponse.json(
      {
        message: 'Authentication service is unavailable',
      },
      {
        status: 502,
      },
    );
  }
}
