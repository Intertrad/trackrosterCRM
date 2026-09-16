import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { backendFetch, forwardBackendResponse, type AuthenticationTokens } from '@/lib/api/backend';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth/session-cookies';

interface LoginRequest {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: LoginRequest;

  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json(
      {
        message: 'Invalid request body',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const response = await backendFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return forwardBackendResponse(response);
    }

    const tokens = (await response.json()) as AuthenticationTokens;

    if (!tokens.accessToken || !tokens.refreshToken) {
      return NextResponse.json(
        {
          message: 'Authentication service returned an invalid response',
        },
        {
          status: 502,
        },
      );
    }

    const cookieStore = await cookies();

    cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, sessionCookieOptions);

    cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, sessionCookieOptions);

    return new Response(null, {
      status: 204,
    });
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
