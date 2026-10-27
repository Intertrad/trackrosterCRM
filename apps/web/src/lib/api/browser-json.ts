import { announceMutation } from '@/lib/live/live-events';
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

    details:
      typeof value.details === 'object' && value.details !== null && !Array.isArray(value.details)
        ? (value.details as Record<string, unknown>)
        : undefined,

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

  if (response.ok) announceMutation(init?.method);

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await readJson(response);

  if (!response.ok) {
    const normalized = normalizeApiError(response.status, body);
    if (!normalized.requestId)
      normalized.requestId = response.headers.get('x-request-id') ?? undefined;
    throw new ApiError(normalized);
  }

  return body as T;
}

export interface BrowserUploadInit extends Omit<RequestInit, 'body'> {
  body: XMLHttpRequestBodyInit;
  onUploadProgress?: (percent: number) => void;
}

/*
 * Fetch does not expose upload progress in the browser. Imports are large
 * enough that the upload needs visible feedback, so use XHR only for this
 * multipart request and keep the same error shape as browserJson.
 */
export function browserUpload<T>(input: RequestInfo | URL, init: BrowserUploadInit): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init.headers);

    request.open(init.method ?? 'POST', url);
    headers.set('accept', 'application/json');
    headers.forEach((value, key) => request.setRequestHeader(key, value));

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        init.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onerror = () => {
      reject(
        new ApiError({
          statusCode: 0,
          code: 'NETWORK_ERROR',
          message: 'Unable to reach TrackRoster',
          error: 'Network Error',
        }),
      );
    };

    request.onload = () => {
      const status = request.status;
      const text = request.responseText;
      let body: unknown;

      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = undefined;
        }
      }

      if (status >= 200 && status < 300) {
        announceMutation(init.method);
        init.onUploadProgress?.(100);
        resolve(body as T);
        return;
      }

      const normalized = normalizeApiError(status, body);
      if (!normalized.requestId) {
        normalized.requestId = request.getResponseHeader('x-request-id') ?? undefined;
      }
      reject(new ApiError(normalized));
    };

    request.send(init.body);
  });
}
