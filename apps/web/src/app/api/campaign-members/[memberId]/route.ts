import type { CampaignMember } from '@/lib/api/campaign-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
): Promise<Response> {
  try {
    const { memberId } = await context.params;

    const updated = await authenticatedBackendJson<CampaignMember>(
      `/campaign-members/${encodeURIComponent(memberId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!updated) {
      return unauthenticatedResponse();
    }

    return Response.json(updated, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
): Promise<Response> {
  try {
    const { memberId } = await context.params;

    await authenticatedBackendJson<undefined>(`/campaign-members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers: writeHeaders(request),
    });

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
