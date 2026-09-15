import { ApiError } from '@/lib/api/api-error';

import { clearAuthCookies, getAccessToken } from './auth-cookies';
import { refreshAuthSession } from './auth-refresh';
import { backendJson } from './backend-json';

export async function authenticatedBackendJson<T>(path: string): Promise<T | null> {
  let accessToken = await getAccessToken();

  let alreadyRefreshed = false;

  /*
   * No access token may simply mean that it expired
   * while a valid refresh session still exists.
   */
  if (!accessToken) {
    const tokens = await refreshAuthSession();

    if (!tokens) {
      return null;
    }

    accessToken = tokens.accessToken;

    alreadyRefreshed = true;
  }

  try {
    return await backendJson<T>(path, {
      accessToken,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) {
      throw error;
    }
  }

  /*
   * If the request already used freshly rotated
   * credentials and Nest still returned 401, the
   * session is no longer trustworthy.
   */
  if (alreadyRefreshed) {
    await clearAuthCookies();

    return null;
  }

  const tokens = await refreshAuthSession();

  if (!tokens) {
    return null;
  }

  try {
    return await backendJson<T>(path, {
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      await clearAuthCookies();

      return null;
    }

    throw error;
  }
}
