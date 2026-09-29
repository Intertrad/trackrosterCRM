import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardedWriteHeaders } from '../../route';

export const dynamic = 'force-dynamic';

/* Revokes every session for this workspace except the caller's own. */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<{ revoked: number }>('/me/sessions/others', {
      method: 'DELETE',
      headers: forwardedWriteHeaders(request),
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
