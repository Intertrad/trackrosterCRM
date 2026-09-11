import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';

import { MAX_DASHBOARD_RANGE_DAYS } from '../reporting/manager-dashboard-query.dto.js';

import { DEFAULT_DASHBOARD_RANGE_DAYS } from '../reporting/manager-dashboard.service.js';

import { ManagerDashboardScopeService } from '../reporting/manager-dashboard-scope.service.js';

import type { ManagerDashboardFilters } from '../reporting/manager-dashboard.types.js';

import { ControlledExportRepository } from './controlled-export.repository.js';

import { ControlledExportSerializerService } from './controlled-export-serializer.service.js';

import type { ControlledExportType, GeneratedExportFile } from './export.types.js';

import { MAX_CONTROLLED_EXPORT_ROWS } from './export.types.js';

import type { ControlledExportQueryDto } from './dto/export-query.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_EXPORT_RANGE_MS = MAX_DASHBOARD_RANGE_DAYS * DAY_MS;

export interface GenerateControlledExportInput {
  tenantId: string;

  actorUserId: string;

  type: ControlledExportType;

  query: ControlledExportQueryDto;
}

@Injectable()
export class ControlledExportService {
  constructor(
    private readonly scopeService: ManagerDashboardScopeService,

    private readonly exportRepository: ControlledExportRepository,

    private readonly serializerService: ControlledExportSerializerService,

    private readonly auditService: AuditService,
  ) {}

  async generate(
    input: GenerateControlledExportInput,
    generatedAt: Date = new Date(),
  ): Promise<GeneratedExportFile> {
    const range = this.resolveRange(input.query, generatedAt);

    const filters = this.buildFilters(input.query);

    /*
     * Authorization happens before the export
     * repository is allowed to read business data.
     *
     * This reuses the exact authority hierarchy:
     *
     * client_admin > director > manager
     */
    const scope = await this.scopeService.resolve({
      tenantId: input.tenantId,

      userId: input.actorUserId,

      filters,
    });

    const exportId = randomUUID();

    const request = {
      tenantId: input.tenantId,

      actorUserId: input.actorUserId,

      exportId,

      type: input.type,

      format: input.query.format,

      generatedAt,

      range,

      scope,

      filters,
    };

    const rows = await this.exportRepository.findRows(request);

    /*
     * Repository deliberately requests
     * MAX + 1 rows.
     *
     * Do not silently truncate exports because that
     * would produce a misleading business artifact.
     */
    if (rows.length > MAX_CONTROLLED_EXPORT_ROWS) {
      throw new PayloadTooLargeException(
        `Export exceeds the maximum of ${MAX_CONTROLLED_EXPORT_ROWS} rows`,
      );
    }

    const file = await this.serializerService.serialize({
      exportId,

      type: input.type,

      format: input.query.format,

      generatedAt,

      rows,
    });

    /*
     * Audit is mandatory.
     *
     * If audit persistence fails, this method throws
     * and the generated file is never returned to the
     * HTTP controller.
     *
     * This is not a DB transaction because exporting
     * is read-only and file generation happens in
     * memory. The guarantee is fail-closed delivery.
     */
    await this.auditService.record({
      tenantId: input.tenantId,

      actorType: 'user',

      actorUserId: input.actorUserId,

      action: 'export.generated',

      resourceType: 'data_export',

      resourceId: exportId,

      metadata: {
        exportType: input.type,

        format: input.query.format,

        rowCount: file.rowCount,

        authority: scope.authority,

        organizationId: scope.organizationId,

        teamId: scope.teamId,

        requestedOrganizationId: filters.organizationId ?? null,

        requestedTeamId: filters.teamId ?? null,

        requestedUserId: filters.userId ?? null,

        requestedCampaignId: filters.campaignId ?? null,

        from: range.from.toISOString(),

        to: range.to.toISOString(),
      },
    });

    return file;
  }

  /*
   * Keep export range behavior aligned with the
   * manager reporting contract.
   */
  private resolveRange(
    query: ControlledExportQueryDto,
    generatedAt: Date,
  ): {
    from: Date;
    to: Date;
  } {
    if (query.from === undefined && query.to === undefined) {
      return {
        from: new Date(generatedAt.getTime() - DEFAULT_DASHBOARD_RANGE_DAYS * DAY_MS),

        to: generatedAt,
      };
    }

    if (query.from === undefined || query.to === undefined) {
      throw new BadRequestException('from and to must be supplied together');
    }

    const fromMs = query.from.getTime();

    const toMs = query.to.getTime();

    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      throw new BadRequestException('Invalid export date range');
    }

    const rangeMs = toMs - fromMs;

    if (rangeMs <= 0) {
      throw new BadRequestException('from must be before to');
    }

    if (rangeMs > MAX_EXPORT_RANGE_MS) {
      throw new BadRequestException(
        `Export range must not exceed ${MAX_DASHBOARD_RANGE_DAYS} days`,
      );
    }

    return {
      from: query.from,

      to: query.to,
    };
  }

  private buildFilters(query: ControlledExportQueryDto): ManagerDashboardFilters {
    return {
      ...(query.organizationId
        ? {
            organizationId: query.organizationId,
          }
        : {}),

      ...(query.teamId
        ? {
            teamId: query.teamId,
          }
        : {}),

      ...(query.userId
        ? {
            userId: query.userId,
          }
        : {}),

      ...(query.campaignId
        ? {
            campaignId: query.campaignId,
          }
        : {}),
    };
  }
}
