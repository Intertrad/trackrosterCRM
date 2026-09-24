import type { ExportJob } from '@/lib/api/export-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ exportId: string }> },
): Promise<Response> {
  try {
    const { exportId } = await context.params;

    const job = await authenticatedBackendJson<ExportJob>(
      `/exports/${encodeURIComponent(exportId)}/cancel`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!job) {
      return unauthenticatedResponse();
    }

    return Response.json(job, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
