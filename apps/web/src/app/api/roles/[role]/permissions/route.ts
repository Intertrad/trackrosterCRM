import type { RolePermissions } from '@/lib/api/role-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ role: string }> },
): Promise<Response> {
  try {
    const { role } = await context.params;

    const result = await authenticatedBackendResource<RolePermissions>(
      `/roles/${encodeURIComponent(role)}/permissions`,
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: responseHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ role: string }> },
): Promise<Response> {
  try {
    const { role } = await context.params;

    const result = await authenticatedBackendResource<RolePermissions>(
      `/roles/${encodeURIComponent(role)}/permissions`,
      { method: 'PUT', headers: writeHeaders(request), body: await request.text() },
    );

    if (!result) {
      return unauthenticatedResponse();
    }

    return Response.json(result.resource, { headers: responseHeaders(result.etag) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/* The upstream validator is forwarded so the next write can send If-Match. */
function responseHeaders(etag: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };

  if (etag) {
    headers.etag = etag;
  }

  return headers;
}
