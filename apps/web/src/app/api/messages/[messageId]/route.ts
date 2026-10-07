import type { Message } from '@/lib/api/messaging-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
): Promise<Response> {
  try {
    const { messageId } = await context.params;

    const message = await authenticatedBackendJson<Message>(
      `/messages/${encodeURIComponent(messageId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!message) {
      return unauthenticatedResponse();
    }

    return Response.json(message, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
): Promise<Response> {
  try {
    const { messageId } = await context.params;

    await authenticatedBackendJson<undefined>(`/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE',
      headers: writeHeaders(request),
    });

    return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ messageId: string }> },
): Promise<Response> {
  try {
    const { messageId } = await context.params;
    const result = await authenticatedBackendJson<{
      messageId: string;
      reactions: Array<{ emoji: string; count: number; reacted: boolean }>;
    }>(`/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!result) return unauthenticatedResponse();
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
