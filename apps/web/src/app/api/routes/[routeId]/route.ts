import type { FieldRoute } from '@/lib/api/route-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { routeWriteHeaders } from '../route';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ routeId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  return proxy(context, {});
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  return proxy(context, {
    method: 'PATCH',
    headers: routeWriteHeaders(request),
    body: await request.text(),
  });
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  return proxy(context, { method: 'DELETE', headers: routeWriteHeaders(request) });
}

async function proxy(context: Context, options: RequestInit): Promise<Response> {
  try {
    const { routeId } = await context.params;

    const result = await authenticatedBackendJson<FieldRoute>(
      `/routes/${encodeURIComponent(routeId)}`,
      options,
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
