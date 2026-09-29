import { Controller, Get, Param, Query, StreamableFile, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';

import { CurrentAuth } from '../auth/current-auth.decorator.js';

import type { AuthenticatedUser } from '../auth/auth.types.js';

import { ControlledExportService } from './controlled-export.service.js';

import { ControlledExportQueryDto } from './dto/export-query.dto.js';

import { ExportTypeParamDto } from './dto/export-type-param.dto.js';

@Controller('exports')
@UseGuards(AuthGuard)
export class ControlledExportController {
  constructor(private readonly exportService: ControlledExportService) {}

  @Get('assignments') assignments(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ControlledExportQueryDto,
  ) {
    return this.export(auth, { type: 'assignments' }, query);
  }
  @Get('activities') activities(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ControlledExportQueryDto,
  ) {
    return this.export(auth, { type: 'activities' }, query);
  }
  @Get('follow_ups') followUps(
    @CurrentAuth() auth: AuthenticatedUser,
    @Query() query: ControlledExportQueryDto,
  ) {
    return this.export(auth, { type: 'follow_ups' }, query);
  }

  async export(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param()
    params: ExportTypeParamDto,

    @Query()
    query: ControlledExportQueryDto,
  ): Promise<StreamableFile> {
    const file = await this.exportService.generate({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      type: params.type,

      query,
    });

    /*
     * Filename is generated entirely by the server.
     *
     * No request-provided filename reaches the
     * Content-Disposition header.
     */
    return new StreamableFile(file.content, {
      type: file.contentType,

      disposition: `attachment; filename="${file.filename}"`,

      length: file.content.length,
    });
  }
}
