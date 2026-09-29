import type { CollisionCheckResult } from '@/lib/api/collision-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * The authoritative pre-contact check. It is a POST because it records a
 * collision event when the contact is refused — that event is what an
 * override request is raised against.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<CollisionCheckResult>('/reservations/check', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
