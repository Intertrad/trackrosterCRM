import { StreamableFile } from '@nestjs/common';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedUser } from '../auth/auth.types.js';

import { ControlledExportController } from './controlled-export.controller.js';

import { ControlledExportService } from './controlled-export.service.js';

describe('ControlledExportController', () => {
  let service: ControlledExportService;

  let controller: ControlledExportController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const auth: AuthenticatedUser = {
    tenantId,

    userId,
  };

  beforeEach(() => {
    service = {
      generate: vi.fn(),
    } as unknown as ControlledExportService;

    controller = new ControlledExportController(service);
  });

  it('forwards authenticated tenant and actor context to the service', async () => {
    vi.mocked(service.generate).mockResolvedValue({
      exportId: '33333333-3333-4333-8333-333333333333',

      type: 'activities',

      format: 'csv',

      filename: 'trackroster-activities-test.csv',

      contentType: 'text/csv; charset=utf-8',

      content: Buffer.from('test-content'),

      rowCount: 1,
    });

    await controller.export(
      auth,

      {
        type: 'activities',
      },

      {
        format: 'csv',
      },
    );

    expect(service.generate).toHaveBeenCalledWith({
      tenantId,

      actorUserId: userId,

      type: 'activities',

      query: {
        format: 'csv',
      },
    });
  });

  it('returns a StreamableFile with CSV download headers', async () => {
    const content = Buffer.from('ID,Campaign ID\r\nrow-1,campaign-1');

    vi.mocked(service.generate).mockResolvedValue({
      exportId: '33333333-3333-4333-8333-333333333333',

      type: 'assignments',

      format: 'csv',

      filename: 'trackroster-assignments-test.csv',

      contentType: 'text/csv; charset=utf-8',

      content,

      rowCount: 1,
    });

    const result = await controller.export(
      auth,

      {
        type: 'assignments',
      },

      {
        format: 'csv',
      },
    );

    expect(result).toBeInstanceOf(StreamableFile);

    expect(result.getHeaders()).toEqual({
      type: 'text/csv; charset=utf-8',

      disposition: 'attachment; filename="trackroster-assignments-test.csv"',

      length: content.length,
    });
  });

  it('returns XLSX download headers', async () => {
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

    vi.mocked(service.generate).mockResolvedValue({
      exportId: '33333333-3333-4333-8333-333333333333',

      type: 'follow_ups',

      format: 'xlsx',

      filename: 'trackroster-follow-ups-test.xlsx',

      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      content,

      rowCount: 2,
    });

    const result = await controller.export(
      auth,

      {
        type: 'follow_ups',
      },

      {
        format: 'xlsx',
      },
    );

    expect(result.getHeaders()).toEqual({
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      disposition: 'attachment; filename="trackroster-follow-ups-test.xlsx"',

      length: content.length,
    });
  });

  it('forwards export filters unchanged for service-side authorization', async () => {
    vi.mocked(service.generate).mockResolvedValue({
      exportId: '33333333-3333-4333-8333-333333333333',

      type: 'activities',

      format: 'csv',

      filename: 'trackroster-activities-test.csv',

      contentType: 'text/csv; charset=utf-8',

      content: Buffer.from('content'),

      rowCount: 0,
    });

    const query = {
      format: 'csv' as const,

      organizationId: '44444444-4444-4444-8444-444444444444',

      teamId: '55555555-5555-4555-8555-555555555555',

      userId: '66666666-6666-4666-8666-666666666666',

      campaignId: '77777777-7777-4777-8777-777777777777',
    };

    await controller.export(
      auth,

      {
        type: 'activities',
      },

      query,
    );

    expect(service.generate).toHaveBeenCalledWith({
      tenantId,

      actorUserId: userId,

      type: 'activities',

      query,
    });
  });

  it('propagates service authorization failures without producing a file', async () => {
    vi.mocked(service.generate).mockRejectedValueOnce(new Error('forbidden'));

    await expect(
      controller.export(
        auth,

        {
          type: 'activities',
        },

        {
          format: 'csv',
        },
      ),
    ).rejects.toThrow('forbidden');
  });
});
