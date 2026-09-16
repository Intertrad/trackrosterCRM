import type { WorkQueueResponse } from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED_QUERY_PARAMETERS = ['teamId', 'campaignId', 'q', 'cursor', 'limit'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    /*
     * Only explicitly supported Work Queue filters
     * may cross the browser -> BFF -> Nest boundary.
     *
     * In particular, tenantId and userId can never be
     * supplied through this endpoint.
     */
    for (const parameter of ALLOWED_QUERY_PARAMETERS) {
      const value = requestUrl.searchParams.get(parameter);

      if (value !== null) {
        backendQuery.set(parameter, value);
      }
    }

    const query = backendQuery.toString();

    const backendPath = query ? `/work-queue?${query}` : '/work-queue';

    const workQueue = await authenticatedBackendJson<WorkQueueResponse>(backendPath);

    if (!workQueue) {
      return unauthenticatedResponse();
    }

    return Response.json(workQueue);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
