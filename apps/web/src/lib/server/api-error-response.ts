import { ApiError } from '@/lib/api/api-error';

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        statusCode: error.statusCode,
        code: error.code,
        message: error.messages.length === 1 ? error.messages[0] : error.messages,
        error: error.errorName,
        requestId: error.requestId,
      },
      {
        status: error.statusCode,
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
