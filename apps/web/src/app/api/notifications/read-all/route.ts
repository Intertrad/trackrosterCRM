import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    const key = request.headers.get('idempotency-key');

    if (key) {
      headers['idempotency-key'] = key;
    }

    const result = await authenticatedBackendJson<{ updated: number }>('/notifications/read-all', {
      method: 'POST',
      headers,
      body: '{}',
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
