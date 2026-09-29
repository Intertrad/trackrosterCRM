import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendDownload } from '@/lib/server/authenticated-backend-download';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ exportId: string }> },
): Promise<Response> {
  try {
    const { exportId } = await context.params;

    const token = new URL(request.url).searchParams.get('token');

    if (!token) {
      return Response.json(
        {
          statusCode: 400,
          code: 'MISSING_TOKEN',
          message: 'A download token is required',
          error: 'Bad Request',
        },
        { status: 400 },
      );
    }

    const download = await authenticatedBackendDownload(
      `/exports/${encodeURIComponent(exportId)}/file?token=${encodeURIComponent(token)}`,
    );

    if (!download) {
      return unauthenticatedResponse();
    }

    return new Response(download.body, {
      headers: {
        'content-type': download.contentType,
        'content-disposition':
          download.contentDisposition ?? `attachment; filename="export-${exportId}"`,
        'cache-control': 'no-store',
        /* Generated CSV/XLSX; never let a browser sniff it as HTML. */
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
