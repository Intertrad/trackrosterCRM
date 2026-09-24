import type { FieldRoute } from '@/lib/api/route-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { routeWriteHeaders } from '../../route';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ routeId: string }> },
): Promise<Response> {
  try {
    const { routeId } = await context.params;

    const result = await authenticatedBackendJson<FieldRoute>(
      `/routes/${encodeURIComponent(routeId)}/stop-order`,
      { method: 'PUT', headers: routeWriteHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
