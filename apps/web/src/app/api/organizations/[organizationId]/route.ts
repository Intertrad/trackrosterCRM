import type { OrganizationDetail } from '@/lib/api/organization-client';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
): Promise<Response> {
  try {
    const { organizationId } = await context.params;
    const result = await authenticatedBackendResource<OrganizationDetail>(
      `/organizations/${encodeURIComponent(organizationId)}`,
    );

    if (!result || !result.resource) return unauthenticatedResponse();

    const headers = new Headers({ 'cache-control': 'no-store' });
    if (result.etag) headers.set('etag', result.etag);
    return Response.json(result.resource, { headers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
