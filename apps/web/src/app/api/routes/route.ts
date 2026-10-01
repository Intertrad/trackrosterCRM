import type { FieldRoute, RoutePage } from '@/lib/api/route-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { routeWriteHeaders } from '@/lib/server/route-headers';

export const dynamic = 'force-dynamic';

const ALLOWED = ['teamId', 'status', 'cursor', 'limit'] as const;

export async function GET(request: Request): Promise<Response> {
  try {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();

    for (const key of ALLOWED) {
      const value = requestUrl.searchParams.get(key);

      if (value !== null) {
        query.set(key, value);
      }
    }

    const search = query.toString();

    const page = await authenticatedBackendJson<RoutePage>(
      search ? `/routes?${search}` : '/routes',
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const created = await authenticatedBackendJson<FieldRoute>('/routes', {
      method: 'POST',
      headers: routeWriteHeaders(request),
      body: await request.text(),
    });

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* Idempotency-Key and If-Match are forwarded unchanged; every route write is
 * idempotent upstream. */
