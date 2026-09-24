import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendDownload } from '@/lib/server/authenticated-backend-download';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ importId: string }> },
): Promise<Response> {
  try {
    const { importId } = await context.params;

    const download = await authenticatedBackendDownload(
      `/imports/${encodeURIComponent(importId)}/report`,
    );

    if (!download) {
      return unauthenticatedResponse();
    }

    const headers: Record<string, string> = {
      'content-type': download.contentType,
      'cache-control': 'no-store',
      /* The report is generated CSV; never let a browser sniff it as HTML. */
      'x-content-type-options': 'nosniff',
    };

    headers['content-disposition'] =
      download.contentDisposition ?? `attachment; filename="import-${importId}-report.csv"`;

    return new Response(download.body, { headers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
