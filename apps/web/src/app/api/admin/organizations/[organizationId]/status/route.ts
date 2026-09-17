import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendAdminOrganization,
  buildOrganizationStatusPayload,
  readAdminJson,
  toBrowserAdminOrganization,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    organizationId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { organizationId } = await context.params;

    const input = await readAdminJson(request);

    const organization = await authenticatedBackendJson<BackendAdminOrganization>(
      `/organizations/${encodeURIComponent(organizationId)}/status`,
      {
        method: 'PATCH',

        body: JSON.stringify(buildOrganizationStatusPayload(input)),
      },
    );

    if (organization === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserAdminOrganization(organization));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
