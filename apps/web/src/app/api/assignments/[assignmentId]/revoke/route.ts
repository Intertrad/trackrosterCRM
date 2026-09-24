import type { Assignment } from '@/lib/api/assignment-lifecycle-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
): Promise<Response> {
  try {
    const { assignmentId } = await context.params;

    const assignment = await authenticatedBackendJson<Assignment>(
      `/assignments/${encodeURIComponent(assignmentId)}/revoke`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!assignment) {
      return unauthenticatedResponse();
    }

    return Response.json(assignment, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
