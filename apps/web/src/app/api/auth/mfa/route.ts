import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/* Removing the factor needs both the password and a live TOTP code. */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<undefined>('/auth/mfa', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
    });

    if (result === null) {
      return unauthenticatedResponse();
    }

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
