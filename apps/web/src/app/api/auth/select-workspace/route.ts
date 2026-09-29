import type { AuthenticationResult } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { resolveAuthenticationOutcome } from '@/lib/server/auth-outcome';
import { backendJson } from '@/lib/server/backend-json';

/*
 * Completing a challenge can still hand back another challenge — verifying
 * MFA for an identity with several memberships yields a workspace selection.
 * The shared resolver keeps every branch handled in one place.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();

    const result = await backendJson<AuthenticationResult>('/auth/select-tenant', {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body,
    });

    const outcome = await resolveAuthenticationOutcome(result);

    return Response.json(outcome, {
      status: 200,

      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
