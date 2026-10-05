import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    campaignId: string;
    campaignProspectId: string;
    followUpId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { campaignId, campaignProspectId, followUpId } = await context.params;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const idempotencyKey = request.headers.get('idempotency-key');

    if (idempotencyKey !== null) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const result = await authenticatedBackendJson<unknown>(
      `/campaigns/${encodeURIComponent(campaignId)}/prospects/${encodeURIComponent(campaignProspectId)}/follow-ups/${encodeURIComponent(followUpId)}/reschedule-review`,
      {
        method: 'POST',
        headers,
        body: await request.text(),
      },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
