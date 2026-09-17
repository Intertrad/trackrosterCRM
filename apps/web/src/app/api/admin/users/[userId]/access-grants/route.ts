import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendAdminAccessGrant,
  buildCreateAccessGrantPayload,
  readAdminJson,
  toBrowserAdminAccessGrant,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { userId } = await context.params;

    const grants = await authenticatedBackendJson<BackendAdminAccessGrant[]>(
      `/users/${encodeURIComponent(userId)}/access-grants`,
      {
        method: 'GET',
      },
    );

    if (grants === null) {
      return unauthenticatedResponse();
    }

    return Response.json(grants.map(toBrowserAdminAccessGrant));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { userId } = await context.params;

    const input = await readAdminJson(request);

    const grant = await authenticatedBackendJson<BackendAdminAccessGrant>(
      `/users/${encodeURIComponent(userId)}/access-grants`,
      {
        method: 'POST',

        body: JSON.stringify(buildCreateAccessGrantPayload(input)),
      },
    );

    if (grant === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserAdminAccessGrant(grant), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
