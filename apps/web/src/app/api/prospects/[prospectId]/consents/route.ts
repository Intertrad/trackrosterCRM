import type { Consent, ConsentPage } from '@/lib/api/consent-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery, writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ prospectId: string }> },
): Promise<Response> {
  try {
    const { prospectId } = await context.params;

    const search = forwardQuery(request, ['cursor', 'limit']);

    const path = `/prospects/${encodeURIComponent(prospectId)}/consents`;

    const page = await authenticatedBackendJson<ConsentPage>(search ? `${path}?${search}` : path);

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ prospectId: string }> },
): Promise<Response> {
  try {
    const { prospectId } = await context.params;

    const created = await authenticatedBackendJson<Consent>(
      `/prospects/${encodeURIComponent(prospectId)}/consents`,
      { method: 'POST', headers: writeHeaders(request), body: await request.text() },
    );

    if (!created) {
      return unauthenticatedResponse();
    }

    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
