import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendJson } from '@/lib/server/backend-json';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();

    await backendJson<void>('/auth/password/reset', {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body,
    });

    /*
     * The reset consumes the token and revokes sessions server-side; the
     * user is deliberately returned to sign-in rather than auto-logged-in.
     */
    return new Response(null, {
      status: 204,

      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
