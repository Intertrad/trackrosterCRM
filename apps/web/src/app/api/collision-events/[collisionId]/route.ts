import type { CollisionEvent } from '@/lib/api/collision-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ collisionId: string }> },
): Promise<Response> {
  try {
    const { collisionId } = await context.params;

    const event = await authenticatedBackendJson<CollisionEvent>(
      `/collision-events/${encodeURIComponent(collisionId)}`,
    );

    if (!event) {
      return unauthenticatedResponse();
    }

    return Response.json(event, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
