import type { ExportJob, ExportJobPage } from '@/lib/api/export-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ['cursor', 'limit']);

    const page = await authenticatedBackendJson<ExportJobPage>(
      search ? `/exports?${search}` : '/exports',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* Answers 202 upstream: the file is produced asynchronously. */
export async function POST(request: Request): Promise<Response> {
  try {
    const job = await authenticatedBackendJson<ExportJob>('/exports', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!job) {
      return unauthenticatedResponse();
    }

    return Response.json(job, { status: 202, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
