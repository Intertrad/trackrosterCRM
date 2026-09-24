import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import {
  type BackendProspectorTodayResponse,
  toBrowserProspectorTodayResponse,
} from '@/lib/server/prospector-today-bff';

export const dynamic = 'force-dynamic';

const ALLOWED_QUERY_PARAMETERS = ['teamId', 'timeZone'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    /*
     * The selected team and browser timezone are
     * request context only. Identity and tenant
     * authority always come from the server session.
     */
    for (const parameter of ALLOWED_QUERY_PARAMETERS) {
      const value = requestUrl.searchParams.get(parameter);

      if (value !== null) {
        backendQuery.set(parameter, value);
      }
    }

    const query = backendQuery.toString();

    const backendPath = query ? `/prospector/today?${query}` : '/prospector/today';

    const today = await authenticatedBackendJson<BackendProspectorTodayResponse>(backendPath);

    if (!today) {
      return unauthenticatedResponse();
    }

    return Response.json(toBrowserProspectorTodayResponse(today));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
