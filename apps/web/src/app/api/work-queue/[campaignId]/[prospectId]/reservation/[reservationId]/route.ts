import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import type {
  ReleasedProspectReservation,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
    reservationId: string;
  }>;
}

async function requireWorkQueueProspect(
  request: Request,
  campaignId: string,
  prospectId: string,
): Promise<boolean | null> {
  const requestUrl = new URL(request.url);

  const teamId = requestUrl.searchParams.get('teamId');

  const query = new URLSearchParams();

  if (teamId !== null) {
    query.set('teamId', teamId);
  }

  const encodedCampaignId = encodeURIComponent(campaignId);
  const encodedProspectId = encodeURIComponent(prospectId);

  const basePath = `/work-queue/${encodedCampaignId}` + `/${encodedProspectId}`;

  const queryString = query.toString();

  const detail = await authenticatedBackendJson<WorkQueueProspectDetail>(
    queryString ? `${basePath}?${queryString}` : basePath,
  );

  if (!detail) {
    return null;
  }

  return true;
}
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId, reservationId } = await context.params;
    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    const backendPath =
      `/campaigns/${encodeURIComponent(campaignId)}` +
      `/prospects/${encodeURIComponent(prospectId)}` +
      `/reservation/${encodeURIComponent(reservationId)}`;

    const released = await authenticatedBackendJson<ReleasedProspectReservation>(backendPath, {
      method: 'DELETE',
    });

    if (!released) {
      return unauthenticatedResponse();
    }

    return Response.json({
      released: true,

      reservationId: released.reservationId,
    } satisfies ReleasedProspectReservation);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
