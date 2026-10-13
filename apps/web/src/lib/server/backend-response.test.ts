import { describe, expect, it } from 'vitest';

import { parseBackendResponse } from './backend-response';

describe('backend response error contract', () => {
  it('preserves structured details and the request id header', async () => {
    const response = Response.json(
      {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        error: 'Bad Request',
        details: { fields: { name: 'Required' } },
      },
      { status: 400, headers: { 'x-request-id': 'req-123' } },
    );

    await expect(parseBackendResponse(response)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      requestId: 'req-123',
      details: { fields: { name: 'Required' } },
    });
  });
});
