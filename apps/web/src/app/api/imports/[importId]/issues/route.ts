import type { ImportIssuePage } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ importId: string }> },
): Promise<Response> {
  try {
    const { importId } = await context.params;

    const search = forwardQuery(request, ['cursor', 'limit']);

    const path = `/imports/${encodeURIComponent(importId)}/issues`;

    const page = await authenticatedBackendJson<ImportIssuePage>(
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
