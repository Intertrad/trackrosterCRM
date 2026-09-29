import type { ProspectTimelinePage, WorkQueueProspectDetail } from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED_TIMELINE_QUERY_PARAMETERS = ['limit', 'cursor'] as const;

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

    /*
     * The Work Queue timeline must remain inside the
     * same personal-assignment boundary as the detail
     * page.
     *
     * Therefore teamId is used to authorize against
     * the Work Queue detail endpoint before historical
     * timeline data is requested.
     */
    const detailQuery = new URLSearchParams();

    const teamId = requestUrl.searchParams.get('teamId');

    if (teamId !== null) {
      detailQuery.set('teamId', teamId);
    }

    const encodedCampaignId = encodeURIComponent(campaignId);

    const encodedProspectId = encodeURIComponent(prospectId);

    const detailQueryString = detailQuery.toString();

    const detailBasePath = `/work-queue/${encodedCampaignId}` + `/${encodedProspectId}`;

    const detailPath = detailQueryString
      ? `${detailBasePath}?${detailQueryString}`
      : detailBasePath;

    /*
     * This call delegates the security decision back
     * to Nest:
     *
     * - exact Prospector team grant
     * - authenticated user owns current assignment
     * - campaign/prospect still belongs to Work Queue
     *
     * It prevents the Work Queue BFF from exposing a
     * same-team prospect belonging to another user.
     */
    const detail = await authenticatedBackendJson<WorkQueueProspectDetail>(detailPath);

    if (!detail) {
      return unauthenticatedResponse();
    }

    const timelineQuery = new URLSearchParams();

    /*
     * Only timeline pagination parameters may reach
     * the existing Nest timeline endpoint.
     */
    for (const parameter of ALLOWED_TIMELINE_QUERY_PARAMETERS) {
      const value = requestUrl.searchParams.get(parameter);

      if (value !== null) {
        timelineQuery.set(parameter, value);
      }
    }

    const timelineQueryString = timelineQuery.toString();

    const timelineBasePath =
      `/campaigns/${encodedCampaignId}` + `/prospects/${encodedProspectId}` + '/timeline';

    const timelinePath = timelineQueryString
      ? `${timelineBasePath}?${timelineQueryString}`
      : timelineBasePath;

    const timeline = await authenticatedBackendJson<ProspectTimelinePage>(timelinePath);

    if (!timeline) {
      return unauthenticatedResponse();
    }

    return Response.json(timeline);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
