import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

import type {
  AcquiredProspectReservation,
  ProspectReservationState,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
  }>;
}

interface BackendProspectReservation {
  reservationId: string;

  tenantId: string;

  organizationId: string;

  campaignId: string;
  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;
  teamId: string;
  userId: string;

  acquiredAt: string;
  expiresAt: string;
}

interface AcquireReservationRequestBody {
  overrideId?: unknown;
}

function buildReservationPath(campaignId: string, prospectId: string): string {
  return (
    `/campaigns/${encodeURIComponent(campaignId)}` +
    `/prospects/${encodeURIComponent(prospectId)}` +
    '/reservation'
  );
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

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    const reservation = await authenticatedBackendJson<ProspectReservationState>(
      buildReservationPath(campaignId, prospectId),
    );

    if (!reservation) {
      return unauthenticatedResponse();
    }

    /*
     * Nest already returns the sanitized reservation
     * state contract for GET.
     */
    return Response.json(reservation);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    /*
     * The only browser-controlled acquisition field
     * permitted through this BFF is overrideId.
     *
     * Identity and ownership context remain entirely
     * server-authenticated.
     */
    let requestBody: AcquireReservationRequestBody = {};

    try {
      requestBody = (await request.json()) as AcquireReservationRequestBody;
    } catch {
      /*
       * Reservation acquisition supports no body.
       */
      requestBody = {};
    }

    const backendPayload: Record<string, string> = {};

    if (typeof requestBody.overrideId === 'string') {
      backendPayload.overrideId = requestBody.overrideId;
    }

    const reservation = await authenticatedBackendJson<BackendProspectReservation>(
      buildReservationPath(campaignId, prospectId),
      {
        method: 'POST',

        body: JSON.stringify(backendPayload),
      },
    );

    if (!reservation) {
      return unauthenticatedResponse();
    }

    /*
     * The raw Nest acquisition response contains
     * authorization and internal workflow metadata.
     *
     * Browser clients only need the reservation token
     * and its time window.
     */
    const response: AcquiredProspectReservation = {
      reservationId: reservation.reservationId,

      acquiredAt: reservation.acquiredAt,

      expiresAt: reservation.expiresAt,
    };

    return Response.json(response, {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
