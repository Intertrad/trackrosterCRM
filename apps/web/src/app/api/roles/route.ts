import type { RoleCatalogue } from '@/lib/api/role-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const roles = await authenticatedBackendJson<RoleCatalogue>('/roles');

    if (!roles) {
      return unauthenticatedResponse();
    }

    return Response.json(roles, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
