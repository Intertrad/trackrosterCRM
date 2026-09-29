import type { SearchResultPage } from '@/lib/api/search-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    /* Scope comes from the authenticated session upstream; the client never
     * supplies a tenant. */
    const search = forwardQuery(request, ['q', 'type', 'limit', 'cursor']);

    const page = await authenticatedBackendJson<SearchResultPage>(`/search?${search}`);

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
