import { MAX_IMPORT_FILE_BYTES } from '@/lib/api/import-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

/**
 * Inspects an uploaded workbook and returns its worksheet names. Keep this
 * proxy separate from the upload route because the browser needs to inspect
 * a multi-sheet workbook before it can choose the sheet to import.
 */
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

    /* Buffering keeps the body replayable if the auth token is refreshed. */
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

    /* Preserve the multipart boundary exactly as supplied by the browser. */
    const result = await authenticatedBackendJson<{ sheets: string[] }>(
      `/imports/${encodeURIComponent(importId)}/file/sheets`,
      {
        method: 'POST',
        headers: { 'content-type': contentType },
        body,
      },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
