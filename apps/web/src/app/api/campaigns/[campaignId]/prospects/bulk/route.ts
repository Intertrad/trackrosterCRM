import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * Commits the enrolment. One bulk request, never a loop: the upstream statement
 * selects and inserts atomically, and a per-establishment call would turn 4,524
 * rows into 4,524 transactions.
 *
 * writeHeaders forwards the browser's idempotency key unchanged, which is what
 * makes a retry after an uncertain response safe.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const result = await authenticatedBackendJson<unknown>(
      `/campaigns/${encodeURIComponent(campaignId)}/prospects/bulk`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (result === null) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
