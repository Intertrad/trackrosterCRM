import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    userId: string;
    grantId: string;
  }>;
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { userId, grantId } = await context.params;

    const result = await authenticatedBackendJson<void>(
      `/users/${encodeURIComponent(userId)}/access-grants/${encodeURIComponent(grantId)}`,
      {
        method: 'DELETE',
      },
    );

    /*
     * A successful void backend response may be
     * undefined. Only null has the special meaning
     * "authentication could not be established".
     */
    if (result === null) {
      return unauthenticatedResponse();
    }

    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
