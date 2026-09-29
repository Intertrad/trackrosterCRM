import { OPERATIONS } from '@/lib/workspace/operations';
import type { Operation } from '@/lib/workspace/types';
import { apiErrorResponse, unauthenticatedResponse } from './api-error-response';
import { authenticatedBackendResource } from './authenticated-backend-resource';
import { writeHeaders } from './write-headers';

const operations = Object.values(OPERATIONS).sort(
  (a, b) => a.path.split(':').length - b.path.split(':').length,
);

/** The proxy accepts only the reviewed operations, never arbitrary upstream URLs. */
export function matchWorkspaceOperation(method: string, segments: string[]): Operation | undefined {
  if (segments.some((part) => !/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]*$/.test(part) || part.includes('..')))
    return;
  return operations.find((op) => {
    if (op.method !== method) return false;
    const parts = op.path.slice(1).split('/');
    return (
      parts.length === segments.length &&
      parts.every((part, index) => part.startsWith(':') || part === segments[index])
    );
  });
}

export async function proxyWorkspaceRequest(
  request: Request,
  segments: string[],
): Promise<Response> {
  const operation = matchWorkspaceOperation(request.method, segments);
  if (!operation)
    return Response.json({ message: 'This operation is unavailable.' }, { status: 404 });
  const write = !['GET', 'HEAD'].includes(request.method);
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  if (
    write &&
    ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
  ) {
    return Response.json({ message: 'Cross-site request refused.' }, { status: 403 });
  }
  const query = new URLSearchParams();
  for (const field of operation.query) {
    for (const value of url.searchParams.getAll(field.name)) query.append(field.name, value);
  }
  try {
    let body: string | undefined;
    if (write && request.method !== 'DELETE') {
      const source = await request.text();
      if (source.length > 1_048_576)
        return Response.json({ message: 'Request is too large.' }, { status: 413 });
      if (source) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(source);
        } catch {
          return Response.json({ message: 'Invalid form data.' }, { status: 400 });
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return Response.json({ message: 'An object is required.' }, { status: 400 });
        }
        body = JSON.stringify(parsed);
      }
    }
    const result = await authenticatedBackendResource<unknown>(
      `/${segments.map(encodeURIComponent).join('/')}${query.size ? `?${query}` : ''}`,
      { method: request.method, headers: writeHeaders(request), ...(body ? { body } : {}) },
    );
    if (!result) return unauthenticatedResponse();
    const headers = new Headers({ 'cache-control': 'private, no-store' });
    if (result.etag) headers.set('etag', result.etag);
    if (operation.status === 204 || result.resource === undefined)
      return new Response(null, { status: 204, headers });
    return Response.json(result.resource, { status: operation.status, headers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
