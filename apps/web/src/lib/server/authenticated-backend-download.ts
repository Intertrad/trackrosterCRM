import { ApiError } from '../api/api-error';
import { clearAuthCookies, getAccessToken } from './auth-cookies';
import { refreshAuthSession } from './auth-refresh';
import { backendFetch } from './backend-fetch';
import { parseBackendResponse } from './backend-response';

export interface BackendDownload {
  body: ArrayBuffer;
  contentType: string;
  contentDisposition: string | null;
}

/**
 * Same session handling as the JSON helpers, for endpoints that return a file
 * rather than a document.
 *
 * The body is buffered so the single post-refresh retry can replay the
 * request; import reports are one CSV row per imported row, well inside the
 * API's own 10,000-row ceiling.
 *
 * Returns null when the session cannot be established or recovered.
 */
export async function authenticatedBackendDownload(path: string): Promise<BackendDownload | null> {
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
    return await read(path, accessToken);
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
    return await read(path, tokens.accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      await clearAuthCookies();

      return null;
    }

    throw error;
  }
}

async function read(path: string, accessToken: string): Promise<BackendDownload> {
  const response = await backendFetch(path, { accessToken });

  if (!response.ok) {
    /* Errors are still JSON; reuse the shared normalization so the browser
     * sees the same ApiError shape it gets everywhere else. */
    await parseBackendResponse<unknown>(response);

    throw new ApiError({
      statusCode: response.status,
      code: 'UNEXPECTED_BACKEND_ERROR',
      message: 'Download failed',
      error: 'Backend Error',
    });
  }

  return {
    body: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    contentDisposition: response.headers.get('content-disposition'),
  };
}
