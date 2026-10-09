import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('exposes the request id as a response header and preserves structured details', () => {
    const send = vi.fn();
    const header = vi.fn();
    const response = { header, status: vi.fn(() => ({ send })) };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-123' }),
        getResponse: () => response,
      }),
    };

    new ApiExceptionFilter().catch(
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: { fields: { name: 'Required' } },
      }),
      host as never,
    );

    expect(header).toHaveBeenCalledWith('x-request-id', 'request-123');
    expect(response.status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        details: { fields: { name: 'Required' } },
        requestId: 'request-123',
      }),
    );
  });
});
