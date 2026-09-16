import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { refreshSession } from '@/lib/auth/refresh-session';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/session-cookies';

export async function POST(): Promise<Response> {
  try {
    const tokens = await refreshSession();

    if (!tokens) {
      const cookieStore = await cookies();

      cookieStore.delete(ACCESS_TOKEN_COOKIE);
      cookieStore.delete(REFRESH_TOKEN_COOKIE);

      return NextResponse.json(
        {
          message: 'Authentication required',
        },
        {
          status: 401,
        },
      );
    }

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
