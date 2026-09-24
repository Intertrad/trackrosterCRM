import type { ActionEventPage } from '@/lib/api/action-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ actionId: string }> },
): Promise<Response> {
  try {
    const { actionId } = await context.params;

    const page = await authenticatedBackendJson<ActionEventPage>(
      `/actions/${encodeURIComponent(actionId)}/events`,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
