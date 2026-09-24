import { ApiError } from '../api/api-error';
import { clearAuthCookies, getAccessToken } from './auth-cookies';
import { refreshAuthSession } from './auth-refresh';
import { backendFetch } from './backend-fetch';
import { parseBackendResponse } from './backend-response';

export interface BackendResource<T> {
  resource: T;

  /*
   * The upstream validator, forwarded verbatim. The backend derives it from
   * the resource itself and re-checks it under a row lock, so the browser
   * must echo this exact value back in If-Match — recomputing it here would
   * fork the algorithm and silently weaken concurrent-update protection.
   */
  etag: string | null;
}

/**
 * Same session handling as {@link authenticatedBackendJson}, but keeps the
 * response headers so conditional requests survive the BFF hop.
 *
 * Returns null when the session cannot be established or recovered.
 */
export async function authenticatedBackendResource<T>(
  path: string,
  options: RequestInit = {},
): Promise<BackendResource<T> | null> {
  let accessToken = await getAccessToken();

  let alreadyRefreshed = false;

  if (!accessToken) {
    const tokens = await refreshAuthSession();

    if (!tokens) {
      return null;
    }

    accessToken = tokens.accessToken;
    alreadyRefreshed = true;
  }

  try {
    return await readResource<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) {
      throw error;
    }
  }

  if (alreadyRefreshed) {
    await clearAuthCookies();

    return null;
  }

  const tokens = await refreshAuthSession();

  if (!tokens) {
    return null;
  }

  try {
    /* Replay the identical request — method, body, If-Match and
     * Idempotency-Key must not change across the single retry. */
    return await readResource<T>(path, options, tokens.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      await clearAuthCookies();

      return null;
    }

    throw error;
  }
}

async function readResource<T>(
  path: string,
  options: RequestInit,
  accessToken: string,
): Promise<BackendResource<T>> {
  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    !headers.has('content-type') &&
    typeof options.body === 'string'
  ) {
    headers.set('content-type', 'application/json');
  }

  const response = await backendFetch(path, { ...options, headers, accessToken });

  const etag = response.headers.get('etag');

  return {
    resource: await parseBackendResponse<T>(response),
    etag,
  };
}
