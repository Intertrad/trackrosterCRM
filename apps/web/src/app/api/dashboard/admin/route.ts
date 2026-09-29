import type { AdminDashboard } from '@/lib/api/admin-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const dashboard = await authenticatedBackendJson<AdminDashboard>('/dashboard/admin');

    if (!dashboard) {
      return unauthenticatedResponse();
    }

    return Response.json(dashboard, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
