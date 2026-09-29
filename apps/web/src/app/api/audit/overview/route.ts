import type { AuditOverview } from '@/lib/api/audit-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const overview = await authenticatedBackendJson<AuditOverview>('/audit/overview');

    if (!overview) {
      return unauthenticatedResponse();
    }

    return Response.json(overview, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
