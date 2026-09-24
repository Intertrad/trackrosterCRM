import type { AccountProfile } from '@/lib/api/account-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return proxy('/me');
}

export async function PATCH(request: Request): Promise<Response> {
  /*
   * If-Match and Idempotency-Key are forwarded unchanged: the backend
   * re-checks the precondition under a row lock and folds it into the
   * idempotency fingerprint, so rewriting either header here would
   * silently defeat concurrent-update protection.
   */
  return proxy('/me', {
    method: 'PATCH',
    headers: forwardedWriteHeaders(request),
    body: await request.text(),
  });
}

async function proxy(path: string, options?: RequestInit): Promise<Response> {
  try {
    const result = await authenticatedBackendResource<AccountProfile>(path, options);

    if (!result) {
      return unauthenticatedResponse();
    }

    const headers = new Headers({ 'cache-control': 'no-store' });

    if (result.etag) {
      headers.set('etag', result.etag);

      /* Same-origin fetch can only read allow-listed headers by default. */
      headers.set('access-control-expose-headers', 'ETag');
    }

    return Response.json(result.resource, { headers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function forwardedWriteHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  const ifMatch = request.headers.get('if-match');

  if (ifMatch) {
    headers['if-match'] = ifMatch;
  }

  const idempotencyKey = request.headers.get('idempotency-key');

  if (idempotencyKey) {
    headers['idempotency-key'] = idempotencyKey;
  }

  return headers;
}
