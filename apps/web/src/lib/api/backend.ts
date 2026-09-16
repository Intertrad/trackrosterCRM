export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

function getApiBaseUrl(): string {
  const value = process.env.API_BASE_URL;

  if (!value) {
    throw new Error('API_BASE_URL is not configured');
  }

  return value.replace(/\/+$/, '');
}

export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
}

export async function forwardBackendResponse(response: Response): Promise<Response> {
  if (response.status === 204) {
    return new Response(null, {
      status: 204,
    });
  }

  const body = await response.text();

  return new Response(body || null, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
