import type {
  ProspectCollisionDecision,
  ProspectCollisionReasonCode,
  ProspectCollisionDecisionValue,
  WorkQueueProspectDetail,
} from '@/lib/api/work-queue-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
  }>;
}

interface BackendCollisionDecision {
  decision: ProspectCollisionDecisionValue;

  reasonCode: ProspectCollisionReasonCode;

  establishmentId: string;

  conflict:
    | {
        expiresAt: string;
      }
    | {
        dueAt: string;
      }
    | {
        assignedAt: string;
      }
    | null;
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

    const collisionDecision = await authenticatedBackendJson<BackendCollisionDecision>(
      `/campaigns/${encodeURIComponent(campaignId)}` +
        `/prospects/${encodeURIComponent(prospectId)}` +
        '/collision-decision',
    );

    if (!collisionDecision) {
      return unauthenticatedResponse();
    }

    const response: ProspectCollisionDecision = {
      decision: collisionDecision.decision,

      reasonCode: collisionDecision.reasonCode,

      conflict: collisionDecision.conflict,
    };

    return Response.json(response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
