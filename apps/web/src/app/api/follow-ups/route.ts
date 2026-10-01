import type { FollowUpQueueResponse } from '@/lib/api/follow-up-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import {
  type BackendFollowUpQueueResponse,
  toBrowserFollowUpQueueItem,
} from '@/lib/server/follow-up-bff';

export const dynamic = 'force-dynamic';

const ALLOWED_QUERY_PARAMETERS = ['teamId', 'overdue', 'limit', 'includeCompleted'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    /*
     * Only explicit Follow-Up Queue filters may
     * cross the browser -> BFF -> Nest boundary.
     *
     * tenantId/userId can never be supplied here.
     */
    for (const parameter of ALLOWED_QUERY_PARAMETERS) {
      const value = requestUrl.searchParams.get(parameter);

      if (value !== null) {
        backendQuery.set(parameter, value);
      }
    }

    const query = backendQuery.toString();

    const backendPath = query ? `/follow-ups?${query}` : '/follow-ups';

    const backendResponse =
      await authenticatedBackendJson<BackendFollowUpQueueResponse>(backendPath);

    if (!backendResponse) {
      return unauthenticatedResponse();
    }

    /*
     * Nest's operational queue contains ownership
     * metadata needed for server authorization.
     *
     * Convert that into the minimal browser-facing
     * ownership model instead of exposing user IDs.
     */
    const response: FollowUpQueueResponse = {
      items: backendResponse.items.map(toBrowserFollowUpQueueItem),
    };

    return Response.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
