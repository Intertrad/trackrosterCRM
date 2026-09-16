import type { WorkQueueProspectDetail } from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    /*
     * teamId is the only browser-supplied query
     * parameter allowed to cross this BFF boundary.
     *
     * tenantId and userId always come from the
     * authenticated backend session.
     */
    const teamId = requestUrl.searchParams.get('teamId');

    if (teamId !== null) {
      backendQuery.set('teamId', teamId);
    }

    const query = backendQuery.toString();

    const backendBasePath =
      `/work-queue/${encodeURIComponent(campaignId)}` + `/${encodeURIComponent(prospectId)}`;

    const backendPath = query ? `${backendBasePath}?${query}` : backendBasePath;

    const detail = await authenticatedBackendJson<WorkQueueProspectDetail>(backendPath);

    if (!detail) {
      return unauthenticatedResponse();
    }

    return Response.json(detail);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
