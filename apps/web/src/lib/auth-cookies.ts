import type { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'trackroster_access_token';
export const REFRESH_TOKEN_COOKIE = 'trackroster_refresh_token';

export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export function setAuthCookies(response: NextResponse, tokens: AuthenticationTokens) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, authCookieOptions);

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, authCookieOptions);
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, '', {
    ...authCookieOptions,
    maxAge: 0,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    ...authCookieOptions,
    maxAge: 0,
  });
}
