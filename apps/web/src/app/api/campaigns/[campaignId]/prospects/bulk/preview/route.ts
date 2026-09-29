import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * Preview only: the upstream route writes nothing, which is what lets the
 * operator see how many establishments a selection covers before committing it.
 * The body is forwarded verbatim so the API's own validation — including its
 * refusal of a selection with no criteria — is the single authority on it.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const result = await authenticatedBackendJson<unknown>(
      `/campaigns/${encodeURIComponent(campaignId)}/prospects/bulk/preview`,
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
