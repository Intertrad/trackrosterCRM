import type { Conversation } from '@/lib/api/messaging-types';
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

    const conversation = await authenticatedBackendJson<Conversation>(
      `/conversations/${encodeURIComponent(conversationId)}`,
    );

    if (!conversation) {
      return unauthenticatedResponse();
    }

    return Response.json(conversation, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  try {
    const { conversationId } = await context.params;

    const conversation = await authenticatedBackendJson<Conversation>(
      `/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!conversation) {
      return unauthenticatedResponse();
    }

    return Response.json(conversation, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
