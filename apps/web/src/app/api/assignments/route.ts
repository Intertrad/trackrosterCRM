import type { AssignmentPage } from '@/lib/api/assignment-lifecycle-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, [
      'campaignId',
      'teamId',
      'assignedUserId',
      'status',
      'cursor',
      'limit',
    ]);

    const page = await authenticatedBackendJson<AssignmentPage>(
      search ? `/assignments?${search}` : '/assignments',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
