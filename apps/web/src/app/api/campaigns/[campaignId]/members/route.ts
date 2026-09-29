import type { CampaignMember, CampaignMemberPage } from '@/lib/api/campaign-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const search = forwardQuery(request, ['state', 'membershipId', 'teamId', 'cursor', 'limit']);

    const path = `/campaigns/${encodeURIComponent(campaignId)}/members`;

    const page = await authenticatedBackendJson<CampaignMemberPage>(
      search ? `${path}?${search}` : path,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
): Promise<Response> {
  try {
    const { campaignId } = await context.params;

    const created = await authenticatedBackendJson<CampaignMember>(
      `/campaigns/${encodeURIComponent(campaignId)}/members`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
