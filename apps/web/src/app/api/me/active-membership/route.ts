import type { AuthenticationResult } from '@/lib/api/auth-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { resolveAuthenticationOutcome } from '@/lib/server/auth-outcome';
import { forwardedWriteHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

/*
 * Switching workspace mints a new session and revokes the source one, so the
 * response is a fresh token pair that must replace the current cookies.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<AuthenticationResult>('/me/active-membership', {
      method: 'POST',
      headers: forwardedWriteHeaders(request),
      body: await request.text(),
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    const outcome = await resolveAuthenticationOutcome(result);

    return Response.json(outcome, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
