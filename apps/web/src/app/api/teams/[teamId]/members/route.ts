import type { RosterPage } from '@/lib/api/team-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
): Promise<Response> {
  try {
    const { teamId } = await context.params;

    const search = forwardQuery(request, ['state', 'membershipId', 'cursor', 'limit']);

    const path = `/teams/${encodeURIComponent(teamId)}/members`;

    const page = await authenticatedBackendJson<RosterPage>(search ? `${path}?${search}` : path);

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ teamId: string }> },
): Promise<Response> {
  try {
    const { teamId } = await context.params;

    const created = await authenticatedBackendJson<unknown>(
      `/teams/${encodeURIComponent(teamId)}/members`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (created === null) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
