import type { Team } from '@/lib/api/team-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';
import { teamHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
): Promise<Response> {
  try {
    const { teamId } = await context.params;

    const result = await authenticatedBackendResource<Team>(`/teams/${encodeURIComponent(teamId)}`);

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: teamHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
): Promise<Response> {
  try {
    const { teamId } = await context.params;

    const result = await authenticatedBackendResource<Team>(
      `/teams/${encodeURIComponent(teamId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: teamHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
