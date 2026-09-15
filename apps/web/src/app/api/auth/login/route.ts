import type { AuthenticationTokens } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { setAuthCookies } from '@/lib/server/auth-cookies';
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

    const tokens = await backendJson<AuthenticationTokens>('/auth/login', {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body,
    });

    await setAuthCookies(tokens);

    /*
     * Never return the access or refresh token to
     * browser JavaScript.
     */
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
