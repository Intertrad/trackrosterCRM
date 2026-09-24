import type { AssignmentBatchResult } from '@/lib/api/assignment-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * Preview is a dry run and bulk commits; both are idempotent upstream, so the
 * caller's Idempotency-Key is forwarded unchanged and a retry after an
 * ambiguous failure cannot assign the same lot twice.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    const idempotencyKey = request.headers.get('idempotency-key');

    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const result = await authenticatedBackendJson<AssignmentBatchResult>('/assignments/bulk', {
      method: 'POST',
      headers,
      body: await request.text(),
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
