import type { ImportJob } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ importId: string }> },
): Promise<Response> {
  try {
    const { importId } = await context.params;

    const job = await authenticatedBackendJson<ImportJob>(
      `/imports/${encodeURIComponent(importId)}/mapping`,
      { method: 'PUT', headers: writeHeaders(request), body: await request.text() },
    );

    if (!job) {
      return unauthenticatedResponse();
    }

    return Response.json(job, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
