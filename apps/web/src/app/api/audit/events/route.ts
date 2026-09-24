import type { AuditEventPage, AuditStream } from '@/lib/api/audit-types';
import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendJson } from '@/lib/server/authenticated-backend-json';
import { forwardQuery } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

/*
 * The API pre-filters the log into named streams. They are enumerated here so
 * a crafted ?stream= cannot be concatenated into an arbitrary upstream path.
 */
const STREAMS: readonly AuditStream[] = [
  'events',
  'data-changes',
  'security-events',
  'assignments',
  'overrides',
  'collisions',
  'exports',
];

function resolveStream(value: string | null): AuditStream {
  return STREAMS.includes(value as AuditStream) ? (value as AuditStream) : 'events';
}

export async function GET(request: Request): Promise<Response> {
  try {
    const stream = resolveStream(new URL(request.url).searchParams.get('stream'));

    const search = forwardQuery(request, ['action', 'resourceType', 'cursor', 'limit']);

    const path = `/audit/${stream}`;

    const page = await authenticatedBackendJson<AuditEventPage>(
      search ? `${path}?${search}` : path,
    );

    if (!page) {
      return unauthenticatedResponse();
    }

    return Response.json(page, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
