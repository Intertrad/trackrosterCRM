import type { ProspectCampaignMembershipPage } from '@/lib/api/prospect-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * Which campaigns hold this establishment, and what each has made of it.
 *
 * Forwarded unchanged. The API filters per membership rather than per
 * establishment — seeing the establishment does not confer sight of every
 * campaign in the tenant — and it answers 404 for an establishment the caller may
 * not see at all. Reshaping either here would move an authorisation decision into
 * a proxy.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ prospectId: string }> },
): Promise<Response> {
  try {
    const { prospectId } = await context.params;

    const page = await authenticatedBackendJson<ProspectCampaignMembershipPage>(
      `/prospects/${encodeURIComponent(prospectId)}/campaign-memberships`,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
