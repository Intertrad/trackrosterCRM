import type { CampaignOrganizationPage } from '@/lib/api/campaign-types';
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

    const search = forwardQuery(request, ['state', 'cursor', 'limit']);

    const path = `/campaigns/${encodeURIComponent(campaignId)}/organizations`;

    const page = await authenticatedBackendJson<CampaignOrganizationPage>(
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

    const created = await authenticatedBackendJson<unknown>(
      `/campaigns/${encodeURIComponent(campaignId)}/organizations`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (created === null) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
