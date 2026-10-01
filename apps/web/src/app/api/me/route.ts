import type { AccountProfile } from '@/lib/api/account-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { forwardedWriteHeaders } from '@/lib/server/route-headers';

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
