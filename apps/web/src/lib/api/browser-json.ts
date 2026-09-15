import { ApiError, type ApiErrorPayload } from './api-error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeMessage(value: unknown): string | string[] {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  return 'Request failed';
}

function normalizeApiError(status: number, value: unknown): ApiErrorPayload {
  if (!isRecord(value)) {
    return {
      statusCode: status,
      code: 'UNEXPECTED_RESPONSE',
      message: 'Request failed',
      error: 'Request Error',
    };
  }

  return {
    statusCode: typeof value.statusCode === 'number' ? value.statusCode : status,

    code: typeof value.code === 'string' ? value.code : 'UNEXPECTED_RESPONSE',

    message: normalizeMessage(value.message),

    error: typeof value.error === 'string' ? value.error : 'Request Error',

    requestId: typeof value.requestId === 'string' ? value.requestId : undefined,
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function browserJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      ...init,

      headers: {
        accept: 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Unable to reach TrackRoster',
      error: 'Network Error',
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(normalizeApiError(response.status, body));
  }

  return body as T;
}
