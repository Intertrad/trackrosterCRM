import type { UnassignedProspectPage } from '@/lib/api/assignment-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * Every parameter the upstream filter accepts has to be named here. One that is
 * missing is not an error the caller sees — it is dropped in silence and the
 * page comes back unfiltered, which reads as a filter that does not work.
 */
const ALLOWED = [
  'campaignId',
  'teamId',
  'cursor',
  'limit',
  'search',
  'category',
  'department',
  'city',
  'regionId',
  'lifecycleStage',
  'contactable',
  'availability',
] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of ALLOWED) {
      const value = requestUrl.searchParams.get(key);

      if (value !== null) {
        query.set(key, value);
      }
    }

    /* campaignId is mandatory upstream; failing here gives a clearer error
     * than a 400 from validation. */
    if (!query.get('campaignId')) {
      return Response.json(
        {
          statusCode: 400,
          code: 'CAMPAIGN_REQUIRED',
          message: 'A campaign is required to list unassigned prospects',
          error: 'Bad Request',
        },
        { status: 400 },
      );
    }

    const page = await authenticatedBackendJson<UnassignedProspectPage>(
      `/assignments/unassigned?${query.toString()}`,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
