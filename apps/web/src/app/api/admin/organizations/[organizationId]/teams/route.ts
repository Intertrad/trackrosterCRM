import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendAdminTeam,
  buildCreateTeamPayload,
  readAdminJson,
  toBrowserAdminTeam,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    organizationId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { organizationId } = await context.params;

    const teams = await authenticatedBackendJson<BackendAdminTeam[]>(
      `/organizations/${encodeURIComponent(organizationId)}/teams`,
      {
        method: 'GET',
      },
    );

    if (teams === null) {
      return unauthenticatedResponse();
    }

    return Response.json(teams.map(toBrowserAdminTeam));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { organizationId } = await context.params;

    const input = await readAdminJson(request);

    const team = await authenticatedBackendJson<BackendAdminTeam>(
      `/organizations/${encodeURIComponent(organizationId)}/teams`,
      {
        method: 'POST',

        body: JSON.stringify(buildCreateTeamPayload(input)),
      },
    );

    if (team === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserAdminTeam(team), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
