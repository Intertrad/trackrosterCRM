import type { SearchFacets } from '@/lib/api/search-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ['q']);

    const facets = await authenticatedBackendJson<SearchFacets>(`/search/facets?${search}`);

    if (!facets) {
      return unauthenticatedResponse();
    }

    return Response.json(facets, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
