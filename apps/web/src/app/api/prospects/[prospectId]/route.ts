import type { ProspectDetail } from '@/lib/api/prospect-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * One establishment from the shared référentiel.
 *
 * The body is forwarded as it arrives. The API decides what the caller may see —
 * an establishment outside every campaign is visible to a tenant-scoped grant
 * alone — and it answers 404 rather than 403 for anything else, which is it
 * declining to disclose that the record exists. Reshaping that here, or turning a
 * refusal into an empty object, would hide an authorisation result.
 *
 * The id is not validated here either: the API applies ParseUUIDPipe, and a
 * second rule in the proxy would be one more thing to disagree with it.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ prospectId: string }> },
): Promise<Response> {
  try {
    const { prospectId } = await context.params;

    const prospect = await authenticatedBackendJson<ProspectDetail>(
      `/prospects/${encodeURIComponent(prospectId)}`,
    );

    if (!prospect) {
      return unauthenticatedResponse();
    }

    return Response.json(prospect, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
