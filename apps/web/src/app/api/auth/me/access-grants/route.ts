import type { SelfAccessContext } from '@/lib/api/auth-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const context = await authenticatedBackendJson<SelfAccessContext>('/auth/me/access-grants');

    if (!context) {
      return unauthenticatedResponse();
    }

    return Response.json(context);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
