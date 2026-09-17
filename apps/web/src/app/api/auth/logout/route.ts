import { NextRequest, NextResponse } from 'next/server';

import { clearAuthCookies, REFRESH_TOKEN_COOKIE } from '@/lib/auth-cookies';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.TRACKROSTER_API_URL;

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (apiUrl && refreshToken) {
    try {
      const backendResponse = await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
        cache: 'no-store',
      });

      if (!backendResponse.ok && backendResponse.status !== 401) {
        console.error(`TrackRoster API logout failed with status ${backendResponse.status}`);
      }
    } catch (error) {
      console.error('Unable to reach TrackRoster logout API', error);
    }
  }

  const response = new NextResponse(null, {
    status: 204,
  });

  clearAuthCookies(response);

  return response;
}
