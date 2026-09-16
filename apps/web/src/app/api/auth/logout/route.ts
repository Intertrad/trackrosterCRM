import { cookies } from 'next/headers';

import { backendFetch } from '@/lib/api/backend';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/session-cookies';

export async function POST(): Promise<Response> {
  const cookieStore = await cookies();

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  try {
    if (refreshToken) {
      await backendFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken,
        }),
      });
    }
  } catch {
    /*
     * Local logout must still succeed even if the API is unavailable.
     * The server-side refresh session will eventually expire/revoke
     * independently.
     */
  } finally {
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
  }

  return new Response(null, {
    status: 204,
  });
}
