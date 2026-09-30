import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<unknown>('/organization-coordination-policies');
    return result === null
      ? unauthenticatedResponse()
      : Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const result = await authenticatedBackendJson<unknown>('/organization-coordination-policies', {
      method: 'POST',
      headers: writeHeaders(request),
      body: await request.text(),
    });
    return result === null ? unauthenticatedResponse() : Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
