import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { campaignId } = await context.params;
    const query = forwardQuery(request, ['establishmentIds']);
    // This browser route only resolves explicit selections, never an unbounded base.
    if (!new URL(request.url).searchParams.get('establishmentIds'))
      return Response.json({ message: 'Select establishment IDs' }, { status: 400 });
    const result = await authenticatedBackendJson<unknown>(
      `/campaigns/${encodeURIComponent(campaignId)}/prospects?${query}`,
    );
    return result === null
      ? unauthenticatedResponse()
      : Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
