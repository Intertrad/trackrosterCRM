import type { AuthenticationResult } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { resolveAuthenticationOutcome } from '@/lib/server/auth-outcome';
import { backendJson } from '@/lib/server/backend-json';

export async function POST(request: Request): Promise<Response> {
  try {
    /*
     * Forward the JSON payload rather than duplicating
     * backend validation rules in this route.
     *
     * Nest remains authoritative for:
     * - email validation
     * - maximum lengths
     * - password requirements
     */
    const body = await request.text();

    const result = await backendJson<AuthenticationResult>('/auth/login', {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body,
    });

    /*
     * Login does not always end in a session: the identity may still owe
     * an MFA code, a first MFA enrolment, or a workspace choice. Only the
     * token branch sets cookies.
     */
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
