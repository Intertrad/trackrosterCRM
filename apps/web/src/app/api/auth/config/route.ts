import type { AuthConfig } from '@/lib/api/auth-types';
import { apiErrorResponse } from '@/lib/server/api-error-response';
import { backendJson } from '@/lib/server/backend-json';

/*
 * Drives which sign-in methods the UI may render. SSO buttons and the
 * password-recovery link are only shown when the backend reports them as
 * configured, so the form never offers a route that cannot complete.
 */
export async function GET(): Promise<Response> {
  try {
    const config = await backendJson<AuthConfig>('/auth/config', {
      method: 'GET',
    });

    return Response.json(config, {
      status: 200,

      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
