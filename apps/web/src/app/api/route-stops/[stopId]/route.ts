import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { routeWriteHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ stopId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return proxy(request, context, 'PATCH', await request.text());
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  return proxy(request, context, 'DELETE');
}

async function proxy(
  request: Request,
  context: Context,
  method: string,
  body?: string,
): Promise<Response> {
  try {
    const { stopId } = await context.params;

    const result = await authenticatedBackendJson<unknown>(
      `/route-stops/${encodeURIComponent(stopId)}`,
      { method, headers: routeWriteHeaders(request), ...(body ? { body } : {}) },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
