import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const ACCESS_TOKEN_COOKIE = 'trackroster_access_token';
export const REFRESH_TOKEN_COOKIE = 'trackroster_refresh_token';

const isProduction = process.env.NODE_ENV === 'production';

export const sessionCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

export function clearCookieOptions(): Partial<ResponseCookie> {
  return {
    ...sessionCookieOptions,
    maxAge: 0,
  };
}
