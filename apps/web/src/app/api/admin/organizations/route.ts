import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendAdminOrganization,
  buildCreateOrganizationPayload,
  readAdminJson,
  toBrowserAdminOrganization,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const organizations = await authenticatedBackendJson<BackendAdminOrganization[]>(
      '/organizations',
      {
        method: 'GET',
      },
    );

    if (organizations === null) {
      return unauthenticatedResponse();
    }

    return Response.json(organizations.map(toBrowserAdminOrganization));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readAdminJson(request);

    const organization = await authenticatedBackendJson<BackendAdminOrganization>(
      '/organizations',
      {
        method: 'POST',

        body: JSON.stringify(buildCreateOrganizationPayload(input)),
      },
    );

    if (organization === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserAdminOrganization(organization), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
