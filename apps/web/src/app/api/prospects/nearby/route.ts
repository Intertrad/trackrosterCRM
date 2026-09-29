import type { NearbyProspectPage } from '@/lib/api/nearby-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    /*
     * Coordinates are the caller's own position. They stay in the query
     * string to the API and are never logged here.
     */
    const search = forwardQuery(request, [
      'latitude',
      'longitude',
      'radiusMeters',
      'limit',
      'cursor',
      'campaignId',
      'teamId',
      'stage',
    ]);

    const page = await authenticatedBackendJson<NearbyProspectPage>(
      search ? `/prospects/nearby?${search}` : '/prospects/nearby',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
