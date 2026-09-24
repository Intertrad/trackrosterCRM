import type { ExportDownload } from '@/lib/api/export-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface BackendExportDownload {
  url: string;
  expiresAt: string;
  filename: string | null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ exportId: string }> },
): Promise<Response> {
  try {
    const { exportId } = await context.params;

    const issued = await authenticatedBackendJson<BackendExportDownload>(
      `/exports/${encodeURIComponent(exportId)}/download`,
    );

    if (!issued) {
      return unauthenticatedResponse();
    }

    /*
     * The API hands back its own absolute path carrying the token. The
     * browser cannot call it: the upstream file endpoint still requires the
     * bearer token, which lives in an httpOnly cookie this proxy holds and
     * JavaScript cannot read. So the link is rewritten to our own file route,
     * which re-attaches the session on the way through.
     *
     * Only the token is carried across; the upstream host is never exposed.
     */
    const token = new URL(issued.url, 'http://placeholder.invalid').searchParams.get('token');

    if (!token) {
      return Response.json(
        {
          statusCode: 502,
          code: 'MALFORMED_DOWNLOAD',
          message: 'The export service returned a link without a token',
          error: 'Bad Gateway',
        },
        { status: 502 },
      );
    }

    const download: ExportDownload = {
      url: `/api/exports/${encodeURIComponent(exportId)}/file?token=${encodeURIComponent(token)}`,
      expiresAt: issued.expiresAt,
      filename: issued.filename,
    };

    return Response.json(download, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
