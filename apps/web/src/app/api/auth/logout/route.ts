import { ApiError } from '@/lib/api/api-error';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { clearAuthCookies, getRefreshToken } from '@/lib/server/auth-cookies';
import { backendJson } from '@/lib/server/backend-json';

export async function POST(): Promise<Response> {
  const refreshToken = await getRefreshToken();

  let logoutFailure: unknown;

  try {
    if (refreshToken) {
      await backendJson<void>('/auth/logout', {
        method: 'POST',

        body: JSON.stringify({
          refreshToken,
        }),
      });
    }
  } catch (error) {
    /*
     * An already-invalid refresh token means there is
     * no usable authenticated backend session through
     * this token, so local logout may still succeed.
     */
    if (!(error instanceof ApiError && error.statusCode === 401)) {
      logoutFailure = error;
    }
  } finally {
    /*
     * Local logout must always remove browser tokens,
     * even when the backend is temporarily unavailable.
     */
    await clearAuthCookies();
  }

  if (logoutFailure) {
    return apiErrorResponse(logoutFailure);
  }

  return new Response(null, {
    status: 204,
  });
}
