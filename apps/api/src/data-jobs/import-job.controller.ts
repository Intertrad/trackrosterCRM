import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  ImportIssueResolutionDto,
  ImportMappingDto,
  ImportRowsDto,
  JobListDto,
} from './data-jobs.dto.js';
import { ImportJobService } from './import-job.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class ImportJobGuard implements CanActivate {
  constructor(private readonly service: ImportJobService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      await this.service.authorize(
        c.switchToHttp().getRequest<{ auth: AuthenticatedPrincipal }>().auth,
      );
      return true;
    });
  }
}
@Controller('imports')
@UseGuards(AuthGuard, ImportJobGuard)
export class ImportJobController {
  constructor(private readonly service: ImportJobService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: JobListDto) {
    return this.service.list(a, q);
  }
  @Post() @Idempotent('import_job.create') create(@CurrentAuth() a: AuthenticatedPrincipal) {
    return this.service.create(a);
  }
  @Get(':importId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Post(':importId/file')
  @HttpCode(200)
  async file(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Req()
    r: {
      isMultipart(): boolean;
      file(): Promise<
        { filename: string; fieldname: string; toBuffer(): Promise<Buffer> } | undefined
      >;
    },
    @Headers('if-match') v?: string,
  ) {
    if (!r.isMultipart()) throw new BadRequestException('Multipart file required');
    await this.service.row(a, id);
    const file = await r.file();
    if (!file || file.fieldname !== 'file')
      throw new BadRequestException('Use multipart field file');
    return this.service.upload(a, id, file.filename, await file.toBuffer(), v);
  }
  @Put(':importId/mapping') @Idempotent('import_job.mapping') mapping(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Body() b: ImportMappingDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mapping(a, id, b, v);
  }
  @Post(':importId/validate') @HttpCode(200) @Idempotent('import_job.validate') validate(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.validate(a, id, v);
  }
  @Get(':importId/rows') rows(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Query() q: ImportRowsDto,
  ) {
    return this.service.rows(a, id, q);
  }
  @Get(':importId/issues') issues(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Query() q: JobListDto,
  ) {
    return this.service.issues(a, id, q);
  }
  @Post(':importId/commit') @HttpCode(200) @Idempotent('import_job.commit') commit(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.commit(a, id, v);
  }
  @Post(':importId/cancel') @HttpCode(200) @Idempotent('import_job.cancel') cancel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.cancel(a, id, v);
  }
  @Get(':importId/report') async report(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('importId', new ParseUUIDPipe()) id: string,
  ) {
    const data = await this.service.report(a, id);
    return new StreamableFile(data, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="import-${id}-report.csv"`,
      length: data.length,
    });
  }
}
@Controller('import-issues')
@UseGuards(AuthGuard, ImportJobGuard)
export class ImportIssueController {
  constructor(private readonly service: ImportJobService) {}
  @Patch(':issueId') @Idempotent('import_job.resolve') resolve(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('issueId', new ParseUUIDPipe()) id: string,
    @Body() b: ImportIssueResolutionDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.resolve(a, id, b, v);
  }
}
