import type { ImportJob } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ issueId: string }> },
): Promise<Response> {
  try {
    const { issueId } = await context.params;

    const job = await authenticatedBackendJson<ImportJob>(
      `/import-issues/${encodeURIComponent(issueId)}`,
      { method: 'PATCH', headers: writeHeaders(request), body: await request.text() },
    );

    if (!job) {
      return unauthenticatedResponse();
    }

    return Response.json(job, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
