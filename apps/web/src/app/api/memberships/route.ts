import type { MembershipPage, MembershipSummary } from '@/lib/api/membership-types';
import { writeHeaders } from '@/lib/server/write-headers';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED = [
  'teamId',
  'organizationId',
  'territoryId',
  'campaignId',
  'role',
  'status',
  'search',
  'cursor',
  'limit',
] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();

    /* Tenant and effective scope always come from the session, never the client. */
    for (const key of ALLOWED) {
      const value = requestUrl.searchParams.get(key);

      if (value !== null) {
        query.set(key, value);
      }
    }

    const search = query.toString();

    const page = await authenticatedBackendJson<MembershipPage>(
      search ? `/memberships?${search}` : '/memberships',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    /* Invitations, not user records: the admin never sets another person's
     * password. POST /memberships issues a token the invitee redeems. */
    const created = await authenticatedBackendJson<MembershipSummary>('/memberships', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
