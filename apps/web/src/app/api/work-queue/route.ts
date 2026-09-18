import { NextRequest, NextResponse } from 'next/server';

import { clearAuthCookies, setAuthCookies } from '@/lib/auth-cookies';

import { authenticatedBackendFetch, type AuthenticatedBackendResult } from '@/lib/backend-auth';

function applyAuthCookieChanges(
  response: NextResponse,
  authResult: AuthenticatedBackendResult,
): NextResponse {
  if (authResult.shouldClearCookies) {
    clearAuthCookies(response);

    return response;
  }

  if (authResult.tokensToSet) {
    setAuthCookies(response, authResult.tokensToSet);
  }

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const backendParams = new URLSearchParams();

    const limit = searchParams.get('limit');
    const search = searchParams.get('search');
    const cursor = searchParams.get('cursor');

    if (limit) {
      backendParams.set('limit', limit);
    }

    if (search) {
      backendParams.set('search', search);
    }

    if (cursor) {
      backendParams.set('cursor', cursor);
    }

    const query = backendParams.toString();

    const path = query ? `/work-queue?${query}` : '/work-queue';

    const authResult = await authenticatedBackendFetch(path, {
      method: 'GET',
    });

    const { response } = authResult;

    if (response.status === 401) {
      return applyAuthCookieChanges(
        new NextResponse(null, {
          status: 401,
        }),
        authResult,
      );
    }

    if (response.status === 403) {
      return applyAuthCookieChanges(
        NextResponse.json(
          {
            message: 'Prospector access is required.',
          },
          {
            status: 403,
          },
        ),
        authResult,
      );
    }

    if (!response.ok) {
      return applyAuthCookieChanges(
        NextResponse.json(
          {
            message: 'Unable to load the work queue.',
          },
          {
            status: response.status >= 500 ? 502 : response.status,
          },
        ),
        authResult,
      );
    }

    const body: unknown = await response.json();

    return applyAuthCookieChanges(NextResponse.json(body), authResult);
  } catch {
    return NextResponse.json(
      {
        message: 'Unable to reach TrackRoster services.',
      },
      {
        status: 502,
      },
    );
  }
}
