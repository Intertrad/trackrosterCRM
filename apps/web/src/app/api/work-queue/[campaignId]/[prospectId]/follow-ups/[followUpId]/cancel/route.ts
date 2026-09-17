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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId, followUpId } = await context.params;

    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    const followUp = await authenticatedBackendJson<BackendProspectFollowUp>(
      buildFollowUpActionPath(campaignId, prospectId, followUpId, 'cancel'),
      {
        method: 'POST',

        headers: getIdempotencyHeaders(request),
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
