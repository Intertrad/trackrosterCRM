import type { MessagingMember } from '@/lib/api/messaging-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/**
 * The messaging directory is intentionally separate from the membership
 * administration API. Every active tenant member may message another active
 * member, while membership administration remains client-admin-only.
 */
export async function GET(): Promise<Response> {
  try {
    const members = await authenticatedBackendJson<MessagingMember[]>('/conversations/members');

    if (!members) return unauthenticatedResponse();

    return Response.json(members, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
