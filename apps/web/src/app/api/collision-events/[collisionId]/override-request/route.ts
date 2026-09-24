import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ collisionId: string }> },
): Promise<Response> {
  try {
    const { collisionId } = await context.params;

    const created = await authenticatedBackendJson<unknown>(
      `/collision-events/${encodeURIComponent(collisionId)}/override-request`,
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
