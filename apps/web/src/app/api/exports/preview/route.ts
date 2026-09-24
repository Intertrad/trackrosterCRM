import type { ExportPreview } from '@/lib/api/export-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/* A dry run — no job is created, so no idempotency key is forwarded. */
export async function POST(request: Request): Promise<Response> {
  try {
    const preview = await authenticatedBackendJson<ExportPreview>('/exports/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: await request.text(),
    });

    if (!preview) {
      return unauthenticatedResponse();
    }

    return Response.json(preview, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
