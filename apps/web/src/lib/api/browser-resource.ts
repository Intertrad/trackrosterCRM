import { ApiError } from './api-error';
import { browserJson } from './browser-json';

export interface BrowserResource<T> {
  resource: T;
  etag: string | null;
}

/*
 * browserJson deliberately returns only the parsed body. Conditional writes
 * need the validator too, so this variant performs the same request and keeps
 * the ETag the BFF forwarded from the API.
 */
export async function browserResource<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<BrowserResource<T>> {
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      headers: { accept: 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach TrackRoster',
      error: 'Network Error',
    });
  }

  const etag = response.headers.get('etag');

  if (!response.ok) {
    /* Reuse the shared error normalization by replaying the parsed body. */
    const body: unknown = await response
      .clone()
      .json()
      .catch(() => undefined);

    throw toApiError(response.status, body);
  }

  if (response.status === 204) {
    return { resource: undefined as T, etag };
  }

  return { resource: (await response.json()) as T, etag };
}

function toApiError(status: number, body: unknown): ApiError {
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  return new ApiError({
    statusCode: typeof record.statusCode === 'number' ? record.statusCode : status,
    code: typeof record.code === 'string' ? record.code : 'UNEXPECTED_RESPONSE',
    message:
      typeof record.message === 'string' || Array.isArray(record.message)
        ? (record.message as string | string[])
        : 'Request failed',
    error: typeof record.error === 'string' ? record.error : 'Request Error',
    requestId: typeof record.requestId === 'string' ? record.requestId : undefined,
  });
}

export { browserJson };
