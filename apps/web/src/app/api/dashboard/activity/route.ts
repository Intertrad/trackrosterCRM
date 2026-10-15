import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { forwardQuery } from '@/lib/server/write-headers';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const query = forwardQuery(request, [
      'from',
      'to',
      'organizationId',
      'teamId',
      'userId',
      'campaignId',
    ]);
    const result = await authenticatedBackendJson<unknown>(
      `/dashboard/activity${query ? `?${query}` : ''}`,
    );
    return result
      ? Response.json(result, { headers: { 'cache-control': 'no-store' } })
      : unauthenticatedResponse();
  } catch (error) {
    return apiErrorResponse(error);
  }
}
