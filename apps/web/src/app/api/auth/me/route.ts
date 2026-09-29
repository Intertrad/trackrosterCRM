import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { getAuthenticatedUser } from '@/lib/server/auth-session';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return unauthenticatedResponse();
    }

    return Response.json(user);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
