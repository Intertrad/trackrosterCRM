import type { ProspectFollowUp } from '@/lib/api/follow-up-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { getIdempotencyHeaders, toBrowserProspectFollowUp } from '@/lib/server/follow-up-bff';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ followUpId: string; action: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return handle(request, context, 'POST');
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return handle(request, context, 'PATCH');
}

async function handle(
  request: Request,
  context: Context,
  method: 'POST' | 'PATCH',
): Promise<Response> {
  try {
    const { followUpId, action } = await context.params;
    if (!['complete', 'cancel', 'reschedule'].includes(action)) {
      return Response.json({ message: 'Unsupported follow-up action' }, { status: 404 });
    }
    const body =
      method === 'PATCH'
        ? await request.text()
        : action === 'cancel'
          ? JSON.stringify({ reason: 'Cancelled by administrator' })
          : undefined;
    const result = await authenticatedBackendJson<Record<string, unknown>>(
      `/follow-ups/${encodeURIComponent(followUpId)}/${action}`,
      {
        method,
        headers: {
          ...getIdempotencyHeaders(request),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body } : {}),
      },
    );
    if (!result) return unauthenticatedResponse();
    return Response.json(toBrowserProspectFollowUp(result as never) as ProspectFollowUp);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
