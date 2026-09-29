import { backendFetch } from './backend-fetch';
import { parseBackendResponse } from './backend-response';

interface BackendJsonOptions extends RequestInit {
  accessToken?: string;
}

export async function backendJson<T>(path: string, options: BackendJsonOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (
    options.body !== undefined &&
    !headers.has('content-type') &&
    typeof options.body === 'string'
  ) {
    headers.set('content-type', 'application/json');
  }

  const response = await backendFetch(path, {
    ...options,
    headers,
  });

  return parseBackendResponse<T>(response);
}
