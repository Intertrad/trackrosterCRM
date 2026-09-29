import type { ProspectPage } from '@/lib/api/prospect-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * The shared établissement référentiel — 14,649 rows, so every one of these is a
 * query parameter rather than something the browser narrows after the fact. A
 * page is at most 100 rows; a filter applied here would search the page.
 *
 * Every parameter the API accepts has to be named. One that is missing is not an
 * error the caller sees: it is dropped in silence and the page comes back
 * unfiltered, which reads as a filter that does not work.
 */
const ALLOWED = [
  'search',
  'category',
  'department',
  'city',
  'regionId',
  'campaignId',
  'status',
  'sort',
  'direction',
  'cursor',
  'limit',
] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ALLOWED);

    const page = await authenticatedBackendJson<ProspectPage>(
      search ? `/prospects?${search}` : '/prospects',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
