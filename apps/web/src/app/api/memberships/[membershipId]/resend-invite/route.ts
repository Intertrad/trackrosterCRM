import type { MembershipDetail } from '@/lib/api/membership-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';
import { membershipHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
): Promise<Response> {
  try {
    const { membershipId } = await context.params;

    const result = await authenticatedBackendResource<MembershipDetail>(
      `/memberships/${encodeURIComponent(membershipId)}/resend-invite`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: membershipHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
