import { REPORT_KEYS, type ReportKey } from '@/lib/api/report-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ report: string }> },
): Promise<Response> {
  try {
    const { report } = await context.params;

    /* Enumerated so a crafted key cannot be concatenated into a path. */
    if (!REPORT_KEYS.includes(report as ReportKey)) {
      return Response.json(
        {
          statusCode: 404,
          code: 'UNKNOWN_REPORT',
          message: 'No such report',
          error: 'Not Found',
        },
        { status: 404 },
      );
    }

    const search = forwardQuery(request, [
      'from',
      'to',
      'organizationId',
      'teamId',
      'userId',
      'campaignId',
    ]);

    const path = `/reports/${report}`;

    const envelope = await authenticatedBackendJson<unknown>(search ? `${path}?${search}` : path);

    if (!envelope) {
      return unauthenticatedResponse();
    }

    return Response.json(envelope, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
