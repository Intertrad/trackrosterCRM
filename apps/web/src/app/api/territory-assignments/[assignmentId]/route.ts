import type { TerritoryAssignment } from '@/lib/api/territory-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<Response> {
  try {
    const { assignmentId } = await context.params;

    const updated = await authenticatedBackendJson<TerritoryAssignment>(
      `/territory-assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!updated) {
      return unauthenticatedResponse();
    }

    return Response.json(updated, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* DELETE ends the assignment period; it does not delete the territory. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<Response> {
  try {
    const { assignmentId } = await context.params;

    await authenticatedBackendJson<undefined>(
      `/territory-assignments/${encodeURIComponent(assignmentId)}`,
      { method: 'DELETE', headers: writeHeaders(request) },
    );

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
