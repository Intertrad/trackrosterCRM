import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendAdminTeam,
  buildTeamStatusPayload,
  readAdminJson,
  toBrowserAdminTeam,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    organizationId: string;
    teamId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { organizationId, teamId } = await context.params;

    const input = await readAdminJson(request);

    const team = await authenticatedBackendJson<BackendAdminTeam>(
      `/organizations/${encodeURIComponent(organizationId)}/teams/${encodeURIComponent(
        teamId,
      )}/status`,
      {
        method: 'PATCH',

        body: JSON.stringify(buildTeamStatusPayload(input)),
      },
    );

    if (team === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserAdminTeam(team));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
