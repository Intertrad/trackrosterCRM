import type { AuditEvent } from '@/lib/api/audit-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  try {
    const { eventId } = await context.params;

    const event = await authenticatedBackendJson<AuditEvent>(
      `/audit/events/${encodeURIComponent(eventId)}`,
    );

    if (!event) {
      return unauthenticatedResponse();
    }

    return Response.json(event, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
