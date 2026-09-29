import type { WorkQueueOptionsResponse } from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    const teamId = requestUrl.searchParams.get('teamId');

    if (teamId !== null) {
      backendQuery.set('teamId', teamId);
    }

    const query = backendQuery.toString();

    const backendPath = query ? `/work-queue/options?${query}` : '/work-queue/options';

    const options = await authenticatedBackendJson<WorkQueueOptionsResponse>(backendPath);

    if (!options) {
      return unauthenticatedResponse();
    }

    return Response.json({
      campaigns: options.campaigns.map((campaign) => ({
        id: campaign.id,

        name: campaign.name,
      })),
    } satisfies WorkQueueOptionsResponse);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
