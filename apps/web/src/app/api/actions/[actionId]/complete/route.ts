import type { ActionRecord } from '@/lib/api/action-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardedHeaders } from '../../route';

export const dynamic = 'force-dynamic';

/*
 * The backend applies the whole completion in one transaction: outcome,
 * lifecycle change, next follow-up and reservation disposition. The
 * Idempotency-Key is forwarded so a retry after an ambiguous failure replays
 * the same logical write rather than duplicating history.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ actionId: string }> },
): Promise<Response> {
  try {
    const { actionId } = await context.params;

    const action = await authenticatedBackendJson<ActionRecord>(
      `/actions/${encodeURIComponent(actionId)}/complete`,
      { method: 'POST', headers: forwardedHeaders(request), body: await request.text() },
    );

    if (!action) {
      return unauthenticatedResponse();
    }

    return Response.json(action, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
