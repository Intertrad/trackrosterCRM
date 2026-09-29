import type { MfaRecoveryCodes } from '@/lib/api/auth-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const codes = await authenticatedBackendJson<MfaRecoveryCodes>(
      '/auth/mfa/recovery-codes/regenerate',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: await request.text(),
      },
    );

    if (!codes) {
      return unauthenticatedResponse();
    }

    /* Recovery codes are shown once and never re-fetchable. */
    return Response.json(codes, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
