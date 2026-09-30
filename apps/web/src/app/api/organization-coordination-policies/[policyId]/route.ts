import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ policyId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return mutate(request, context, 'PATCH');
}
export async function DELETE(request: Request, context: Context): Promise<Response> {
  return mutate(request, context, 'DELETE');
}
async function mutate(
  request: Request,
  context: Context,
  method: 'PATCH' | 'DELETE',
): Promise<Response> {
  try {
    const { policyId } = await context.params;
    const result = await authenticatedBackendJson<unknown>(
      `/organization-coordination-policies/${encodeURIComponent(policyId)}`,
      {
        method,
        headers: writeHeaders(request),
        ...(method === 'PATCH' ? { body: await request.text() } : {}),
      },
    );
    return result === null ? unauthenticatedResponse() : Response.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
