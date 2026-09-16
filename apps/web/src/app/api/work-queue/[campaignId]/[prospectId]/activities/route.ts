import type {
  ProspectActivityType,
  RecordedProspectActivity,
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

interface BackendProspectActivity {
  id: string;

  tenantId: string;

  campaignId: string;
  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  userId: string;

  reservationId: string;

  type: ProspectActivityType;

  occurredAt: string;

  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    /*
     * Authorization is checked before body validation so this
     * mutation preserves the same personal Work Queue boundary
     * as detail, timeline, reservation and collision operations.
     */
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

    /*
     * Browser-controlled identity/context fields are discarded.
     * Nest remains responsible for validating the activity enum.
     */
    const backendPayload: Record<string, string> = {};

    if (isRecord(requestBody) && typeof requestBody.type === 'string') {
      backendPayload.type = requestBody.type;
    }

    const idempotencyKey = request.headers.get('idempotency-key');

    const headers: Record<string, string> = {};

    /*
     * Never generate or replace this key in the BFF.
     * A logical retry must reach Nest with the exact key chosen
     * by the browser client.
     *
     * When absent, omit it so Nest returns its canonical
     * IDEMPOTENCY_KEY_REQUIRED error.
     */
    if (idempotencyKey !== null) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const activity = await authenticatedBackendJson<BackendProspectActivity>(
      `/campaigns/${encodeURIComponent(campaignId)}` +
        `/prospects/${encodeURIComponent(prospectId)}` +
        '/activities',
      {
        method: 'POST',

        headers,

        body: JSON.stringify(backendPayload),
      },
    );

    if (!activity) {
      return unauthenticatedResponse();
    }

    /*
     * Raw activity rows contain tenant, ownership, assignment,
     * establishment and reservation identifiers. The browser
     * only needs the recorded action and occurrence timestamp.
     */
    const response: RecordedProspectActivity = {
      id: activity.id,

      type: activity.type,

      occurredAt: activity.occurredAt,
    };

    return Response.json(response, {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
