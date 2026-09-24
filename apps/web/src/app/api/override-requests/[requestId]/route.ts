import type { OverrideRequestDetail } from '@/lib/api/override-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<Response> {
  try {
    const { requestId } = await context.params;

    const detail = await authenticatedBackendJson<OverrideRequestDetail>(
      `/override-requests/${encodeURIComponent(requestId)}`,
    );

    if (!detail) {
      return unauthenticatedResponse();
    }

    return Response.json(detail, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
