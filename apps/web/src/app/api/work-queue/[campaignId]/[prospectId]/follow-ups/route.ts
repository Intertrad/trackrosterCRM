import type { ProspectFollowUp, ProspectFollowUpListResponse } from '@/lib/api/follow-up-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import {
  type BackendProspectFollowUp,
  type BackendProspectFollowUpListResponse,
  buildProspectFollowUpsPath,
  getIdempotencyHeaders,
  requireWorkQueueProspect,
  toBrowserProspectFollowUp,
} from '@/lib/server/follow-up-bff';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidOwnershipResponse(): Response {
  return Response.json(
    {
      statusCode: 400,
      code: 'INVALID_REQUEST',
      message: 'Follow-up ownership must be user or team',
      error: 'Bad Request',
    },
    {
      status: 400,
    },
  );
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    const authorized = await requireWorkQueueProspect(request, campaignId, prospectId);

    if (authorized === null) {
      return unauthenticatedResponse();
    }

    const backendResponse = await authenticatedBackendJson<BackendProspectFollowUpListResponse>(
      buildProspectFollowUpsPath(campaignId, prospectId),
    );

    if (!backendResponse) {
      return unauthenticatedResponse();
    }

    const response: ProspectFollowUpListResponse = {
      items: backendResponse.items.map(toBrowserProspectFollowUp),
    };

    return Response.json(response);
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

    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }

    const backendPayload: {
      dueAt?: string;
      assignedUserId?: null;
    } = {};

    if (isRecord(requestBody) && typeof requestBody.dueAt === 'string') {
      backendPayload.dueAt = requestBody.dueAt;
    }

    if (isRecord(requestBody) && requestBody.ownership !== undefined) {
      if (requestBody.ownership !== 'user' && requestBody.ownership !== 'team') {
        return invalidOwnershipResponse();
      }

      if (requestBody.ownership === 'team') {
        backendPayload.assignedUserId = null;
      }
    }

    const followUp = await authenticatedBackendJson<BackendProspectFollowUp>(
      buildProspectFollowUpsPath(campaignId, prospectId),
      {
        method: 'POST',

        headers: getIdempotencyHeaders(request),

        body: JSON.stringify(backendPayload),
      },
    );

    if (!followUp) {
      return unauthenticatedResponse();
    }

    const response: ProspectFollowUp = toBrowserProspectFollowUp(followUp);

    return Response.json(response, {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
