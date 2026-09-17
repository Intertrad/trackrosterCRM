import type { ProspectFollowUp } from '@/lib/api/follow-up-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import {
  type BackendProspectFollowUp,
  buildFollowUpActionPath,
  getIdempotencyHeaders,
  requireWorkQueueProspect,
  toBrowserProspectFollowUp,
} from '@/lib/server/follow-up-bff';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
    followUpId: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId, followUpId } = await context.params;

    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }

    const backendPayload: {
      dueAt?: string;
    } = {};

    if (isRecord(requestBody) && typeof requestBody.dueAt === 'string') {
      backendPayload.dueAt = requestBody.dueAt;
    }

    const followUp = await authenticatedBackendJson<BackendProspectFollowUp>(
      buildFollowUpActionPath(campaignId, prospectId, followUpId, 'reschedule'),
      {
        method: 'PATCH',

        headers: getIdempotencyHeaders(request),

        body: JSON.stringify(backendPayload),
      },
    );

    if (!followUp) {
      return unauthenticatedResponse();
    }

    const response: ProspectFollowUp = toBrowserProspectFollowUp(followUp);

    return Response.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
