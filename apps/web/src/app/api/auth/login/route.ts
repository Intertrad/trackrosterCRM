import { NextResponse } from 'next/server';

import { type AuthenticationTokens, setAuthCookies } from '@/lib/auth-cookies';

interface LoginRequest {
  email: string;
  password: string;
}

function isAuthenticationTokens(value: unknown): value is AuthenticationTokens {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tokens = value as Record<string, unknown>;

  return typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string';
}

export async function POST(request: Request) {
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

  let input: LoginRequest;

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          message: 'Invalid login request.',
        },
        {
          status: 400,
        },
      );
    }

    const candidate = body as Record<string, unknown>;

    if (typeof candidate.email !== 'string' || typeof candidate.password !== 'string') {
      return NextResponse.json(
        {
          message: 'Email and password are required.',
        },
        {
          status: 400,
        },
      );
    }

    input = {
      email: candidate.email,
      password: candidate.password,
    };
  } catch {
    return NextResponse.json(
      {
        message: 'Invalid login request.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const backendResponse = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      if (backendResponse.status === 401) {
        return NextResponse.json(
          {
            message: 'Invalid email or password.',
          },
          {
            status: 401,
          },
        );
      }

      if (backendResponse.status >= 400 && backendResponse.status < 500) {
        return NextResponse.json(
          {
            message: 'Login request was rejected.',
          },
          {
            status: backendResponse.status,
          },
        );
      }

      console.error(`TrackRoster API login failed with status ${backendResponse.status}`);

      return NextResponse.json(
        {
          message: 'Authentication service is unavailable.',
        },
        {
          status: 502,
        },
      );
    }

    const tokens: unknown = await backendResponse.json();

    if (!isAuthenticationTokens(tokens)) {
      console.error('TrackRoster API returned an invalid authentication response');

      return NextResponse.json(
        {
          message: 'Authentication service returned an invalid response.',
        },
        {
          status: 502,
        },
      );
    }

    const response = new NextResponse(null, {
      status: 204,
    });

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
