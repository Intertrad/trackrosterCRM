import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendManagedUser,
  buildUserStatusPayload,
  readAdminJson,
  toBrowserManagedUser,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    userId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { userId } = await context.params;

    const input = await readAdminJson(request);

    const user = await authenticatedBackendJson<BackendManagedUser>(
      `/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',

        body: JSON.stringify(buildUserStatusPayload(input)),
      },
    );

    if (user === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserManagedUser(user));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
