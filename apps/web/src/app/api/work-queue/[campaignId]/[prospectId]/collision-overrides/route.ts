import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    prospectId: string;
  }>;
}

export interface CollisionOverrideRecord {
  id: string;
  campaignId: string;
  prospectId: string;
  createdAt: string;
}

/*
 * A manager override is a grant, not a queue decision: the backend records
 * who approved it, for whom, and why, in one audited write. The reason is
 * mandatory upstream (10-1000 characters) and is forwarded unchanged.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, prospectId } = await context.params;

    const headers: Record<string, string> = { 'content-type': 'application/json' };

    const idempotencyKey = request.headers.get('idempotency-key');

    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const override = await authenticatedBackendJson<CollisionOverrideRecord>(
      `/campaigns/${encodeURIComponent(campaignId)}/prospects/${encodeURIComponent(prospectId)}/collision-overrides`,
      {
        method: 'POST',
        headers,
        body: await request.text(),
      },
    );

    if (!override) {
      return unauthenticatedResponse();
    }

    return Response.json(override, {
      status: 201,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
