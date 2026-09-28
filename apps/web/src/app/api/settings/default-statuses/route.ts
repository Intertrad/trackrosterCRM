import type { OutcomeSettings } from '@/lib/api/outcome-settings-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/*
 * The tenant's configured outcomes.
 *
 * Read only. The API guards the read with authentication alone — every role needs
 * to know the vocabulary it is expected to record against, a prospector most of all
 * — and puts the write behind its own settings guard, which is not proxied here.
 */
export async function GET(): Promise<Response> {
  try {
    const settings = await authenticatedBackendJson<OutcomeSettings>('/settings/default-statuses');

    if (!settings) {
      return unauthenticatedResponse();
    }

    return Response.json(settings, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
