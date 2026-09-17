import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import {
  type BackendManagedUser,
  buildCreateUserPayload,
  readAdminJson,
  toBrowserManagedUser,
} from '@/lib/server/admin-bff';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const users = await authenticatedBackendJson<BackendManagedUser[]>('/users', {
      method: 'GET',
    });

    if (users === null) {
      return unauthenticatedResponse();
    }

    return Response.json(users.map(toBrowserManagedUser));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await readAdminJson(request);

    const user = await authenticatedBackendJson<BackendManagedUser>('/users', {
      method: 'POST',

      body: JSON.stringify(buildCreateUserPayload(input)),
    });

    if (user === null) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserManagedUser(user), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
