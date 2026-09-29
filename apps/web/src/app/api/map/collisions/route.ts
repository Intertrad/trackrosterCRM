import type { MapCollisionPage } from '@/lib/api/map-collision-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const query = forwardQuery(request, ['bbox', 'zoom', 'teamId']);
    const result = await authenticatedBackendJson<MapCollisionPage>(
      query ? `/map/collisions?${query}` : '/map/collisions',
    );
    if (!result) return unauthenticatedResponse();
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
