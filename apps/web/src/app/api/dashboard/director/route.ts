import type { DirectorDashboard } from '@/lib/api/director-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, [
      'from',
      'to',
      'organizationId',
      'teamId',
      'userId',
      'campaignId',
    ]);

    const dashboard = await authenticatedBackendJson<DirectorDashboard>(
      search ? `/dashboard/director?${search}` : '/dashboard/director',
    );

    if (!dashboard) {
      return unauthenticatedResponse();
    }

    return Response.json(dashboard, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
