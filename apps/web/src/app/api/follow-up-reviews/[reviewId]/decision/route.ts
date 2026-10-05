import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ reviewId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { reviewId } = await context.params;
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    for (const header of ['idempotency-key']) {
      const value = request.headers.get(header);

      if (value !== null) {
        headers[header] = value;
      }
    }

    const result = await authenticatedBackendJson<unknown>(
      `/follow-up-reviews/${encodeURIComponent(reviewId)}/decision`,
      {
        method: 'POST',
        headers,
        body: await request.text(),
      },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
