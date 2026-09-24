import type { Message, MessagePage } from '@/lib/api/messaging-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  try {
    const { conversationId } = await context.params;

    const search = forwardQuery(request, ['cursor', 'limit']);

    const path = `/conversations/${encodeURIComponent(conversationId)}/messages`;

    const page = await authenticatedBackendJson<MessagePage>(search ? `${path}?${search}` : path);

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
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

    const message = await authenticatedBackendJson<Message>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!message) {
      return unauthenticatedResponse();
    }

    return Response.json(message, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
