import type { ProspectAddressPage } from '@/lib/api/prospect-contact-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * Read only. The address write paths carry `ProspectWriteGuard` upstream and
 * belong to a family the readiness audit has not certified, so they are not
 * proxied here.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ prospectId: string }> },
): Promise<Response> {
  try {
    const { prospectId } = await context.params;

    const search = forwardQuery(request, ['cursor', 'limit']);

    const path = `/prospects/${encodeURIComponent(prospectId)}/addresses`;

    const page = await authenticatedBackendJson<ProspectAddressPage>(
      search ? `${path}?${search}` : path,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
