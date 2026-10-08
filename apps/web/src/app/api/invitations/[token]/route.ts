import type { InvitationPreview, InvitationAcceptance } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendJson } from '@/lib/server/backend-json';

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;
    const result = await backendJson<InvitationPreview>(
      `/invitations/${encodeURIComponent(token)}`,
      { method: 'GET' },
    );
    return Response.json(result, {
      status: 200,
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;
    const body = await request.text();
    const result = await backendJson<InvitationAcceptance>(
      `/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body },
    );
    return Response.json(result, {
      status: 200,
      headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
