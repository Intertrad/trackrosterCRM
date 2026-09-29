import type { ConversationParticipant } from '@/lib/api/messaging-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  try {
    const { conversationId } = await context.params;

    const participants = await authenticatedBackendJson<ConversationParticipant[]>(
      `/conversations/${encodeURIComponent(conversationId)}/participants`,
    );

    if (!participants) {
      return unauthenticatedResponse();
    }

    return Response.json(participants, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  try {
    const { conversationId } = await context.params;

    const added = await authenticatedBackendJson<unknown>(
      `/conversations/${encodeURIComponent(conversationId)}/participants`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (added === null) {
      return unauthenticatedResponse();
    }

    return Response.json(added, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
