import { ApiError } from '../api/api-error';
import { clearAuthCookies, getAccessToken } from './auth-cookies';
import { refreshAuthSession } from './auth-refresh';
import { backendJson } from './backend-json';

export type AuthenticatedBackendJsonOptions = RequestInit;

export async function authenticatedBackendJson<T>(
  path: string,
  options: AuthenticatedBackendJsonOptions = {},
): Promise<T | null> {
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
      ...options,

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
    /*
     * Reuse the exact request options after refresh.
     *
     * This is important for authenticated mutations:
     * method, body and headers such as Idempotency-Key
     * must remain unchanged across the single retry.
     */
    return await backendJson<T>(path, {
      ...options,

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
