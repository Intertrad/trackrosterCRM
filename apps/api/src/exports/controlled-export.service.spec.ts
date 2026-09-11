import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditService } from '../audit/audit.service.js';

import { ManagerDashboardScopeService } from '../reporting/manager-dashboard-scope.service.js';

import { ControlledExportRepository } from './controlled-export.repository.js';

import { ControlledExportSerializerService } from './controlled-export-serializer.service.js';

import { ControlledExportService } from './controlled-export.service.js';

import { MAX_CONTROLLED_EXPORT_ROWS } from './export.types.js';

describe('ControlledExportService', () => {
  let scopeService: ManagerDashboardScopeService;

  let repository: ControlledExportRepository;

  let serializer: ControlledExportSerializerService;

  let auditService: AuditService;

  let service: ControlledExportService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const generatedAt = new Date('2026-09-11T12:00:00.000Z');

  beforeEach(() => {
    scopeService = {
      resolve: vi.fn(),
    } as unknown as ManagerDashboardScopeService;

    repository = {
      findRows: vi.fn(),
    } as unknown as ControlledExportRepository;

    serializer = {
      serialize: vi.fn(),
    } as unknown as ControlledExportSerializerService;

    auditService = {
      record: vi.fn(),
    } as unknown as AuditService;

    service = new ControlledExportService(scopeService, repository, serializer, auditService);

    vi.mocked(scopeService.resolve).mockResolvedValue({
      authority: 'client_admin',

      organizationId: null,

      teamId: null,
    });

    vi.mocked(repository.findRows).mockResolvedValue([]);

    vi.mocked(serializer.serialize).mockResolvedValue({
      exportId: '33333333-3333-4333-8333-333333333333',

      type: 'activities',

      format: 'csv',

      filename: 'trackroster-activities.csv',

      contentType: 'text/csv; charset=utf-8',

      content: Buffer.from('csv'),

      rowCount: 0,
    });

    vi.mocked(auditService.record).mockResolvedValue(
      {} as Awaited<ReturnType<AuditService['record']>>,
    );
  });

  it('generates a scoped export and audits it', async () => {
    await service.generate(
      {
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',
        },
      },

      generatedAt,
    );

    expect(scopeService.resolve).toHaveBeenCalledWith({
      tenantId,

      userId: actorUserId,

      filters: {},
    });

    expect(repository.findRows).toHaveBeenCalledOnce();

    const repositoryInput = vi.mocked(repository.findRows).mock.calls[0]?.[0];

    expect(repositoryInput).toMatchObject({
      tenantId,

      actorUserId,

      type: 'activities',

      format: 'csv',

      scope: {
        authority: 'client_admin',

        organizationId: null,

        teamId: null,
      },

      filters: {},
    });

    expect(repositoryInput?.range.to).toEqual(generatedAt);

    expect(repositoryInput?.range.from).toEqual(new Date('2026-08-12T12:00:00.000Z'));

    expect(serializer.serialize).toHaveBeenCalledOnce();

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        actorType: 'user',

        actorUserId,

        action: 'export.generated',

        resourceType: 'data_export',

        resourceId: expect.any(String),

        metadata: expect.objectContaining({
          exportType: 'activities',

          format: 'csv',

          rowCount: 0,

          authority: 'client_admin',

          organizationId: null,

          teamId: null,

          from: '2026-08-12T12:00:00.000Z',

          to: '2026-09-11T12:00:00.000Z',
        }),
      }),
    );
  });

  it('passes authorized filters to the scope resolver and repository', async () => {
    const organizationId = '33333333-3333-4333-8333-333333333333';

    const teamId = '44444444-4444-4444-8444-444444444444';

    const campaignId = '55555555-5555-4555-8555-555555555555';

    const userId = '66666666-6666-4666-8666-666666666666';

    vi.mocked(scopeService.resolve).mockResolvedValue({
      authority: 'manager',

      organizationId,

      teamId,
    });

    await service.generate({
      tenantId,

      actorUserId,

      type: 'assignments',

      query: {
        format: 'xlsx',

        organizationId,

        teamId,

        campaignId,

        userId,

        from: new Date('2026-09-01T00:00:00.000Z'),

        to: new Date('2026-09-10T00:00:00.000Z'),
      },
    });

    expect(scopeService.resolve).toHaveBeenCalledWith({
      tenantId,

      userId: actorUserId,

      filters: {
        organizationId,

        teamId,

        userId,

        campaignId,
      },
    });

    expect(repository.findRows).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: {
          authority: 'manager',

          organizationId,

          teamId,
        },

        filters: {
          organizationId,

          teamId,

          userId,

          campaignId,
        },
      }),
    );
  });

  it('rejects a partially supplied date range before querying data', async () => {
    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',

          from: new Date('2026-09-01T00:00:00.000Z'),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(scopeService.resolve).not.toHaveBeenCalled();

    expect(repository.findRows).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('rejects an inverted date range', async () => {
    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'follow_ups',

        query: {
          format: 'csv',

          from: new Date('2026-09-10T00:00:00.000Z'),

          to: new Date('2026-09-01T00:00:00.000Z'),
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.findRows).not.toHaveBeenCalled();
  });

  it('rejects exports exceeding the row limit without serializing or auditing', async () => {
    vi.mocked(repository.findRows).mockResolvedValue(
      Array.from(
        {
          length: MAX_CONTROLLED_EXPORT_ROWS + 1,
        },

        (_, index) => ({
          id: `row-${index}`,
        }),
      ),
    );

    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',
        },
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);

    expect(serializer.serialize).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('does not audit when serialization fails', async () => {
    vi.mocked(serializer.serialize).mockRejectedValueOnce(new Error('serialization failure'));

    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',
        },
      }),
    ).rejects.toThrow('serialization failure');

    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('fails closed when audit persistence fails', async () => {
    vi.mocked(auditService.record).mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',
        },
      }),
    ).rejects.toThrow('audit unavailable');

    expect(serializer.serialize).toHaveBeenCalledOnce();

    expect(auditService.record).toHaveBeenCalledOnce();
  });

  it('does not query or audit when authorization fails', async () => {
    vi.mocked(scopeService.resolve).mockRejectedValueOnce(new Error('forbidden'));

    await expect(
      service.generate({
        tenantId,

        actorUserId,

        type: 'activities',

        query: {
          format: 'csv',
        },
      }),
    ).rejects.toThrow('forbidden');

    expect(repository.findRows).not.toHaveBeenCalled();

    expect(serializer.serialize).not.toHaveBeenCalled();

    expect(auditService.record).not.toHaveBeenCalled();
  });
});
