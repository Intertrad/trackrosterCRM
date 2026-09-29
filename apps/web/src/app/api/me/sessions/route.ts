import type { AccountSessionPage } from '@/lib/api/account-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED_QUERY_PARAMETERS = ['limit', 'cursor'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);

    const backendQuery = new URLSearchParams();

    for (const parameter of ALLOWED_QUERY_PARAMETERS) {
      const value = requestUrl.searchParams.get(parameter);

      if (value !== null) {
        backendQuery.set(parameter, value);
      }
    }

    const query = backendQuery.toString();

    const page = await authenticatedBackendJson<AccountSessionPage>(
      query ? `/me/sessions?${query}` : '/me/sessions',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
