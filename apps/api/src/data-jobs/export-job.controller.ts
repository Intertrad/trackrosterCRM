import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { DownloadExportDto, ExportRequestDto, JobListDto } from './data-jobs.dto.js';
import { ExportJobService } from './export-job.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class ExportJobGuard implements CanActivate {
  constructor(private readonly service: ExportJobService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c
        .switchToHttp()
        .getRequest<{ auth: AuthenticatedPrincipal; params: { exportId?: string } }>();
      if (r.params.exportId) {
        if (!isUUID(r.params.exportId))
          throw new BadRequestException('Valid export identifier required');
        await this.service.row(r.auth, r.params.exportId);
      } else await this.service.authority(r.auth);
      return true;
    });
  }
}
@Controller('exports')
@UseGuards(AuthGuard, ExportJobGuard)
export class ExportJobController {
  constructor(private readonly service: ExportJobService) {}
  @Post('preview') @HttpCode(200) preview(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Body() b: ExportRequestDto,
  ) {
    return this.service.preview(a, b);
  }
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: JobListDto) {
    return this.service.list(a, q);
  }
  @Post() @HttpCode(202) @Idempotent('export_job.create') create(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Body() b: ExportRequestDto,
  ) {
    return this.service.create(a, b);
  }
  @Get(':exportId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('exportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Post(':exportId/cancel') @HttpCode(200) @Idempotent('export_job.cancel') cancel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('exportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.cancel(a, id);
  }
  @Get(':exportId/download') download(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('exportId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.download(a, id);
  }
  @Get(':exportId/audit') audit(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('exportId', new ParseUUIDPipe()) id: string,
    @Query() q: JobListDto,
  ) {
    return this.service.auditHistory(a, id, q);
  }
  @Get(':exportId/file') async file(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('exportId', new ParseUUIDPipe()) id: string,
    @Query() q: DownloadExportDto,
  ) {
    const f = await this.service.file(a, id, q.token);
    return new StreamableFile(f.content, {
      type: f.contentType,
      disposition: `attachment; filename="${f.filename}"`,
      length: f.content.length,
    });
  }
}
