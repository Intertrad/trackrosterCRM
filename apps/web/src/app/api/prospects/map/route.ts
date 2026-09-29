import type { MapProspectResponse } from '@/lib/api/map-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

const ALLOWED = [
  'bbox',
  'zoom',
  'search',
  'lifecycleStage',
  'campaignId',
  'organizationId',
  'teamId',
  'territoryId',
] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const query = forwardQuery(request, ALLOWED);
    const result = await authenticatedBackendJson<MapProspectResponse>(
      query ? `/prospects/map?${query}` : '/prospects/map',
    );

    if (!result) return unauthenticatedResponse();

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
