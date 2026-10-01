import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardedWriteHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    const { sessionId } = await context.params;

    const result = await authenticatedBackendJson<{ revoked: number }>(
      `/me/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'DELETE',
        headers: forwardedWriteHeaders(request),
      },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
