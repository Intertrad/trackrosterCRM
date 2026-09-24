import type { PasswordResetTokenStatus } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendJson } from '@/lib/server/backend-json';

/* Validates the reset token without consuming it, so the page can render
 * the expired/used state before asking for a new password. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await context.params;

    const status = await backendJson<PasswordResetTokenStatus>(
      `/auth/password-reset/${encodeURIComponent(token)}/status`,
      {
        method: 'GET',
      },
    );

    return Response.json(status, {
      status: 200,

      headers: {
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
