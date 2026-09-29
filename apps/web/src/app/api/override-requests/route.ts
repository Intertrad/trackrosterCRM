import type { OverrideRequestPage } from '@/lib/api/override-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED = ['status', 'campaignId', 'reasonCode', 'cursor', 'limit'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();

    /* Only the documented filters are forwarded; scope comes from the session. */
    for (const key of ALLOWED) {
      const value = requestUrl.searchParams.get(key);

      if (value !== null) {
        query.set(key, value);
      }
    }

    const search = query.toString();

    const page = await authenticatedBackendJson<OverrideRequestPage>(
      search ? `/override-requests?${search}` : '/override-requests',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
