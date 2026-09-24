import type { MembershipDetail } from '@/lib/api/membership-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ membershipId: string }> },
): Promise<Response> {
  try {
    const { membershipId } = await context.params;

    const result = await authenticatedBackendResource<MembershipDetail>(
      `/memberships/${encodeURIComponent(membershipId)}`,
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: membershipHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ membershipId: string }> },
): Promise<Response> {
  try {
    const { membershipId } = await context.params;

    const result = await authenticatedBackendResource<MembershipDetail>(
      `/memberships/${encodeURIComponent(membershipId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: membershipHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function membershipHeaders(etag: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };

  if (etag) {
    headers.etag = etag;
  }

  return headers;
}
