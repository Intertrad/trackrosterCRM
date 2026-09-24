import type { ActionRecord } from '@/lib/api/action-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ actionId: string }> },
): Promise<Response> {
  try {
    const { actionId } = await context.params;

    const action = await authenticatedBackendJson<ActionRecord>(
      `/actions/${encodeURIComponent(actionId)}/corrections`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!action) {
      return unauthenticatedResponse();
    }

    return Response.json(action, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
