import type { ProspectTimelinePage } from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * The immutable activity history of one campaign prospect.
 *
 * This exists beside the work-queue timeline proxy rather than replacing it. That
 * one pre-authorizes through the work-queue detail endpoint with a teamId, which
 * keeps a prospector inside their own assignment — a boundary an administrator
 * cannot satisfy, having neither a team nor an assignment. So the two audiences
 * need two proxies, and neither widens anything: the API authorizes both.
 *
 * It authorizes through canViewTeam for an assigned prospect and
 * canViewOrganization for an unassigned one, each of which admits a tenant-scoped
 * client_admin, and it masks a forbidden prospect as 404 so the same tenant cannot
 * enumerate campaigns. Both behaviours pass through untouched — changing the id in
 * the URL to a campaign the caller cannot see still answers 404.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string; campaignProspectId: string }> },
): Promise<Response> {
  try {
    const { campaignId, campaignProspectId } = await context.params;

    const search = forwardQuery(request, ['limit', 'cursor']);

    const path =
      `/campaigns/${encodeURIComponent(campaignId)}` +
      `/prospects/${encodeURIComponent(campaignProspectId)}/timeline`;

    const page = await authenticatedBackendJson<ProspectTimelinePage>(
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
