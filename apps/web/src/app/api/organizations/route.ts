import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export interface OrganizationSummary {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: string;
}

export interface OrganizationPage {
  items: OrganizationSummary[];
  nextCursor: string | null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ['status', 'search', 'cursor', 'limit']);

    const page = await authenticatedBackendJson<OrganizationPage>(
      search ? `/organizations?${search}` : '/organizations',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
