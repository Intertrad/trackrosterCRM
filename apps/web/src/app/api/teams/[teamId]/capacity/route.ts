import type { TeamCapacity } from '@/lib/api/team-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ teamId: string }> },
): Promise<Response> {
  try {
    const { teamId } = await context.params;

    const capacity = await authenticatedBackendJson<TeamCapacity>(
      `/teams/${encodeURIComponent(teamId)}/capacity`,
    );

    if (!capacity) {
      return unauthenticatedResponse();
    }

    return Response.json(capacity, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
