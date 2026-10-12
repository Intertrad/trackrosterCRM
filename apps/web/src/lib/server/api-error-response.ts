import { ApiError } from '@/lib/api/api-error';

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (error.requestId) headers.set('x-request-id', error.requestId);
    return Response.json(
      {
        statusCode: error.statusCode,
        code: error.code,
        message: error.messages.length === 1 ? error.messages[0] : error.messages,
        error: error.errorName,
        ...(error.details ? { details: error.details } : {}),
        requestId: error.requestId,
      },
      {
        status: error.statusCode,
        headers,
      },
    );
  }

  return Response.json(
    {
      statusCode: 502,
      code: 'UPSTREAM_REQUEST_FAILED',
      message: 'Backend service is unavailable',
      error: 'Bad Gateway',
    },
    {
      status: 502,
    },
  );
}

export function unauthenticatedResponse(): Response {
  return Response.json(
    {
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      error: 'Unauthorized',
    },
    {
      status: 401,
    },
  );
}
