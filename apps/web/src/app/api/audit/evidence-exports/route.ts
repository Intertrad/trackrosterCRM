import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardedHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const exportJob = await authenticatedBackendJson('/audit/evidence-exports', {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: await request.text(),
    });

    if (!exportJob) return unauthenticatedResponse();

    return Response.json(exportJob, { status: 202, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
