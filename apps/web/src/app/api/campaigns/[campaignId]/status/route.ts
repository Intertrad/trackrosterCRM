import type { Campaign } from '@/lib/api/campaign-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';
import { campaignHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const result = await authenticatedBackendResource<Campaign>(
      `/campaigns/${encodeURIComponent(campaignId)}/status`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: campaignHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
