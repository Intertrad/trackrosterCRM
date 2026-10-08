import type { InvitationAcceptance } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendJson } from '@/lib/server/backend-json';

/**
 * Accept an invitation through the same origin as the invitation page.
 *
 * The client intentionally uses `/api/invitations/:token/accept` so the
 * token never needs to be sent to a separate origin from the browser. Keep
 * this route in sync with the backend's `/invitations/:token/accept` route.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;
    const result = await backendJson<InvitationAcceptance>(
      `/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: await request.text(),
      },
    );

    return Response.json(result, {
      status: 200,
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
