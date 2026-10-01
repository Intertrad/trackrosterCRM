import type { Campaign } from '@/lib/api/campaign-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';
import { campaignHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const result = await authenticatedBackendResource<Campaign>(
      `/campaigns/${encodeURIComponent(campaignId)}`,
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: campaignHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const result = await authenticatedBackendResource<Campaign>(
      `/campaigns/${encodeURIComponent(campaignId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: campaignHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* DELETE archives the campaign upstream; it is not a hard delete. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    await authenticatedBackendJson<undefined>(`/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'DELETE',
      headers: writeHeaders(request),
    });

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
