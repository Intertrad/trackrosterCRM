import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { refreshAuthSession } from '@/lib/server/auth-refresh';

export async function POST(): Promise<Response> {
  try {
    const tokens = await refreshAuthSession();

    if (!tokens) {
      return unauthenticatedResponse();
    }

    /*
     * Rotated tokens remain HttpOnly.
     */
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
