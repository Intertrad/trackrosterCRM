import type { ImportJob } from '@/lib/api/import-types';
import { MAX_IMPORT_FILE_BYTES } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ importId: string }> },
): Promise<Response> {
  try {
    const { importId } = await context.params;

    const contentType = request.headers.get('content-type');

    if (!contentType?.includes('multipart/form-data')) {
      return Response.json(
        {
          statusCode: 400,
          code: 'INVALID_UPLOAD',
          message: 'The import file must be sent as multipart/form-data',
          error: 'Bad Request',
        },
        { status: 400 },
      );
    }

    /*
     * Buffered rather than streamed: authenticatedBackendJson replays the
     * request once after a token refresh, and a consumed stream cannot be
     * replayed. The API caps uploads at 5 MB, so buffering is bounded.
     */
    const body = await request.arrayBuffer();

    if (body.byteLength > MAX_IMPORT_FILE_BYTES) {
      return Response.json(
        {
          statusCode: 413,
          code: 'FILE_TOO_LARGE',
          message: 'The import file is larger than 5 MB',
          error: 'Payload Too Large',
        },
        { status: 413 },
      );
    }

    /* The multipart boundary lives in content-type and must survive verbatim. */
    const headers: Record<string, string> = { 'content-type': contentType };

    const idempotencyKey = request.headers.get('idempotency-key');

    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const ifMatch = request.headers.get('if-match');

    if (ifMatch) {
      headers['if-match'] = ifMatch;
    }

    const job = await authenticatedBackendJson<ImportJob>(
      `/imports/${encodeURIComponent(importId)}/file`,
      { method: 'POST', headers, body },
    );

    if (!job) {
      return unauthenticatedResponse();
    }

    return Response.json(job, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
