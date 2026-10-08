import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const search = forwardQuery(request, ['organizationId', 'status', 'search', 'cursor', 'limit']);
    const result = await authenticatedBackendJson<unknown>(search ? `/teams?${search}` : '/teams');

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<unknown>('/teams', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
