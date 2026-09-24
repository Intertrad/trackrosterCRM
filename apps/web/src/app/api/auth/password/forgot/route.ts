import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendFetch } from '@/lib/server/backend-fetch';

/*
 * Privacy-safe by contract: the backend answers 202 whether or not the
 * address exists, and this route must not add any signal that would let a
 * caller enumerate accounts.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();

    const response = await backendFetch('/auth/password/forgot', {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body,
    });

    if (response.status === 202 || response.ok) {
      return new Response(null, {
        status: 202,

        headers: {
          'cache-control': 'no-store',
        },
      });
    }

    /* Validation (400) and throttling (429) are still surfaced. */
    return new Response(null, {
      status: response.status,

      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
