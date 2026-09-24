import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const DECISIONS = new Set(['approve', 'reject', 'cancel']);

/*
 * A decision is irreversible and audited. If-Match and Idempotency-Key are
 * forwarded unchanged: the backend re-checks the validator under a row lock,
 * so a request already decided elsewhere fails with 412 rather than being
 * silently re-decided.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string; decision: string }> },
): Promise<Response> {
  try {
    const { requestId, decision } = await context.params;

    if (!DECISIONS.has(decision)) {
      return Response.json(
        {
          statusCode: 404,
          code: 'UNKNOWN_DECISION',
          message: 'Unsupported override decision',
          error: 'Not Found',
        },
        { status: 404 },
      );
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };

    for (const header of ['if-match', 'idempotency-key']) {
      const value = request.headers.get(header);

      if (value) {
        headers[header] = value;
      }
    }

    const result = await authenticatedBackendJson<unknown>(
      `/override-requests/${encodeURIComponent(requestId)}/${decision}`,
      { method: 'POST', headers, body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
