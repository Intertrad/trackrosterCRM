import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import {
  type BackendManagerDashboardResponse,
  buildManagerDashboardBackendPath,
  toBrowserManagerDashboard,
} from '@/lib/server/manager-dashboard-bff';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const dashboard = await authenticatedBackendJson<BackendManagerDashboardResponse>(
      buildManagerDashboardBackendPath(request),
    );

    if (!dashboard) {
      return unauthenticatedResponse();
    }

    const response: ManagerDashboardResponse = toBrowserManagerDashboard(dashboard);

    return Response.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
