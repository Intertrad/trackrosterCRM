import type { TerritoryAssignment, TerritoryAssignmentPage } from '@/lib/api/territory-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, [
      'territoryId',
      'membershipId',
      'teamId',
      'state',
      'cursor',
      'limit',
    ]);

    const page = await authenticatedBackendJson<TerritoryAssignmentPage>(
      search ? `/territory-assignments?${search}` : '/territory-assignments',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const created = await authenticatedBackendJson<TerritoryAssignment>('/territory-assignments', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
