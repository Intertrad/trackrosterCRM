import { apiErrorResponse, unauthenticatedResponse } from '@/lib/server/api-error-response';
import { authenticatedBackendResource } from '@/lib/server/authenticated-backend-resource';
import { writeHeaders } from '@/lib/server/write-headers';

export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  if (segments.some((part) => !/^[a-zA-Z0-9-]+$/.test(part)))
    return Response.json({ message: 'Invalid script path.' }, { status: 400 });
  const path = `/scripts/${segments.map(encodeURIComponent).join('/')}`;
  const write = !['GET', 'HEAD'].includes(request.method);
  const origin = request.headers.get('origin');
  const requestUrl = new URL(request.url);
  if (
    write &&
    ((origin && origin !== requestUrl.origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site')
  )
    return Response.json({ message: 'Cross-site request refused.' }, { status: 403 });
  try {
    const body = write && request.method !== 'DELETE' ? await request.text() : undefined;
    const result = await authenticatedBackendResource<unknown>(`${path}${requestUrl.search}`, {
      method: request.method,
      headers: writeHeaders(request),
      ...(body ? { body } : {}),
    });
    if (!result) return unauthenticatedResponse();
    const headers = new Headers({ 'cache-control': 'private, no-store' });
    if (result.etag) headers.set('etag', result.etag);
    if (result.resource === undefined) return new Response(null, { status: 204, headers });
    return Response.json(result.resource, {
      status: request.method === 'POST' ? 201 : 200,
      headers,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
