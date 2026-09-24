import type { ImportJob, ImportJobPage } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ['cursor', 'limit']);

    const page = await authenticatedBackendJson<ImportJobPage>(
      search ? `/imports?${search}` : '/imports',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const created = await authenticatedBackendJson<ImportJob>('/imports', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* The job body already carries its own `etag` field, so import responses do
 * not need the header echoed the way membership and role reads do. */
