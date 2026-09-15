import { getBackendBaseUrl } from './backend-config';

export interface BackendFetchOptions extends RequestInit {
  accessToken?: string;
}

export async function backendFetch(
  path: string,
  options: BackendFetchOptions = {},
): Promise<Response> {
  const { accessToken, headers: suppliedHeaders, ...requestInit } = options;

  const headers = new Headers(suppliedHeaders);

  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return fetch(`${getBackendBaseUrl()}${normalizedPath}`, {
    ...requestInit,

    headers,

    cache: 'no-store',
  });
}
