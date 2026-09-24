import type { ActionRecord } from '@/lib/api/action-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';

export const dynamic = 'force-dynamic';

const ALLOWED = [
  'campaignId',
  'assigneeMembershipId',
  'status',
  'type',
  'cursor',
  'limit',
] as const;

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

    const page = await authenticatedBackendJson<{
      items: ActionRecord[];
      nextCursor: string | null;
    }>(search ? `/actions?${search}` : '/actions');

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
    const action = await authenticatedBackendJson<ActionRecord>('/actions', {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: await request.text(),
    });

    if (!action) {
      return unauthenticatedResponse();
    }

    return Response.json(action, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export function forwardedHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  for (const header of ['idempotency-key', 'if-match']) {
    const value = request.headers.get(header);

    if (value) {
      headers[header] = value;
    }
  }

  return headers;
}
