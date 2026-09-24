import type { AccountMembership } from '@/lib/api/account-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const memberships = await authenticatedBackendJson<AccountMembership[]>('/me/memberships');

    if (!memberships) {
      return unauthenticatedResponse();
    }

    return Response.json(memberships, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
