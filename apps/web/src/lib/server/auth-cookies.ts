import { cookies } from 'next/headers';

import type { AuthenticationTokens } from '@/lib/api/auth-types';

const ACCESS_TOKEN_COOKIE = 'trackroster_access_token';

const REFRESH_TOKEN_COOKIE = 'trackroster_refresh_token';

interface JwtPayload {
  exp?: number;
}

function getTokenExpiration(token: string): Date | undefined {
  const [, encodedPayload] = token.split('.');

  if (!encodedPayload) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as JwtPayload;

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return undefined;
    }

    return new Date(payload.exp * 1000);
  } catch {
    return undefined;
  }
}

function cookieSecurityOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export async function setAuthCookies(tokens: AuthenticationTokens): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...cookieSecurityOptions(),
    expires: getTokenExpiration(tokens.accessToken),
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...cookieSecurityOptions(),
    expires: getTokenExpiration(tokens.refreshToken),
  });
}

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_TOKEN_COOKIE, '', {
    ...cookieSecurityOptions(),
    expires: new Date(0),
  });

  cookieStore.set(REFRESH_TOKEN_COOKIE, '', {
    ...cookieSecurityOptions(),
    expires: new Date(0),
  });
}
