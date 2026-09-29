import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ teamId: string; membershipId: string }> },
): Promise<Response> {
  try {
    const { teamId, membershipId } = await context.params;

    /* periodId selects which rostering period to amend when there are several. */
    const search = forwardQuery(request, ['periodId']);

    const path =
      `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}` +
      (search ? `?${search}` : '');

    const updated = await authenticatedBackendJson<unknown>(path, {
      method: 'PATCH',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (updated === null) {
      return unauthenticatedResponse();
    }

    return Response.json(updated, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ teamId: string; membershipId: string }> },
): Promise<Response> {
  try {
    const { teamId, membershipId } = await context.params;

    const search = forwardQuery(request, ['periodId']);

    const path =
      `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}` +
      (search ? `?${search}` : '');

    await authenticatedBackendJson<undefined>(path, {
      method: 'DELETE',
      headers: writeHeaders(request),
    });

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
