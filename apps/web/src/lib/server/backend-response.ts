import { ApiError, type ApiErrorPayload } from '@/lib/api/api-error';

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

  return 'Backend request failed';
}

function normalizeErrorPayload(status: number, value: unknown): ApiErrorPayload {
  if (!isRecord(value)) {
    return {
      statusCode: status,
      code: 'UNEXPECTED_BACKEND_ERROR',
      message: 'Backend request failed',
      error: 'Backend Error',
    };
  }

  return {
    statusCode: typeof value.statusCode === 'number' ? value.statusCode : status,

    code: typeof value.code === 'string' ? value.code : 'UNEXPECTED_BACKEND_ERROR',

    message: normalizeMessage(value.message),

    error: typeof value.error === 'string' ? value.error : 'Backend Error',

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

export async function parseBackendResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const body = await readJson(response);

  if (!response.ok) {
    throw new ApiError(normalizeErrorPayload(response.status, body));
  }

  return body as T;
}
