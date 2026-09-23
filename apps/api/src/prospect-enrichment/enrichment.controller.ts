import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  ProspectMasterModule,
  ProspectWriteGuard,
} from '../prospect-master/prospect-master.controller.js';
import { PageDto } from '../prospect-master/prospect-master.dto.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { EnrichmentService } from './enrichment.service.js';
import {
  TagDto,
  UpdateTagDto,
  FieldDto,
  UpdateFieldDto,
  FieldValuesDto,
  DuplicateQueryDto,
  ResolveDuplicateDto,
} from './enrichment.dto.js';
@Controller('tags')
@UseGuards(AuthGuard)
export class TagController {
  constructor(private readonly service: EnrichmentService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: PageDto) {
    return this.service.tagList(a, q);
  }
  @Post()
  @UseGuards(ClientAdminGuard)
  @Idempotent('tag.create')
  @UseInterceptors(ResourceETagInterceptor)
  create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() d: TagDto) {
    return this.service.tagWrite(a, undefined, d);
  }
  @Patch(':tagId')
  @UseGuards(ClientAdminGuard)
  @UseInterceptors(ResourceETagInterceptor)
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('tagId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateTagDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.tagWrite(a, id, d, false, v);
  }
  @Delete(':tagId')
  @UseGuards(ClientAdminGuard)
  @HttpCode(204)
  async remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('tagId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    await this.service.tagWrite(a, id, {}, true, v);
  }
}
@Controller('custom-fields')
@UseGuards(AuthGuard)
export class CustomFieldController {
  constructor(private readonly service: EnrichmentService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: PageDto) {
    return this.service.fieldList(a, q);
  }
  @Post()
  @UseGuards(ClientAdminGuard)
  @Idempotent('field.create')
  @UseInterceptors(ResourceETagInterceptor)
  create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() d: FieldDto) {
    return this.service.fieldWrite(a, undefined, d);
  }
  @Patch(':fieldId')
  @UseGuards(ClientAdminGuard)
  @UseInterceptors(ResourceETagInterceptor)
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('fieldId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateFieldDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.fieldWrite(a, id, d, false, v);
  }
  @Delete(':fieldId')
  @UseGuards(ClientAdminGuard)
  @HttpCode(204)
  async remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('fieldId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    await this.service.fieldWrite(a, id, {}, true, v);
  }
}
@Controller('prospects')
@UseGuards(AuthGuard, ProspectWriteGuard)
export class ProspectEnrichmentController {
  constructor(private readonly service: EnrichmentService) {}
  @Post(':prospectId/tags/:tagId')
  @HttpCode(200)
  tag(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) pid: string,
    @Param('tagId', new ParseUUIDPipe()) tid: string,
  ) {
    return this.service.tagProspect(a, pid, tid);
  }
  @Delete(':prospectId/tags/:tagId')
  @HttpCode(204)
  async untag(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) pid: string,
    @Param('tagId', new ParseUUIDPipe()) tid: string,
  ) {
    await this.service.tagProspect(a, pid, tid, true);
  }
  @Put(':prospectId/custom-fields') values(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) pid: string,
    @Body() d: FieldValuesDto,
  ) {
    return this.service.values(a, pid, d);
  }
}
@Controller('prospect-duplicates')
@UseGuards(AuthGuard)
export class DuplicateController {
  constructor(private readonly service: EnrichmentService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: DuplicateQueryDto) {
    return this.service.duplicateList(a, q);
  }
  @Get(':duplicateId') get(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('duplicateId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.duplicate(a, id);
  }
  @Post(':duplicateId/resolve')
  @UseGuards(ClientAdminGuard)
  @HttpCode(200)
  resolve(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('duplicateId', new ParseUUIDPipe()) id: string,
    @Body() d: ResolveDuplicateDto,
  ) {
    return this.service.resolve(a, id, d);
  }
}
@Controller('data-quality')
@UseGuards(AuthGuard)
export class DataQualityController {
  constructor(private readonly service: EnrichmentService) {}
  @Get('overview') overview(@CurrentAuth() a: AuthenticatedPrincipal) {
    return this.service.quality(a);
  }
}
@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule, ProspectMasterModule],
  controllers: [
    TagController,
    CustomFieldController,
    ProspectEnrichmentController,
    DuplicateController,
    DataQualityController,
  ],
  providers: [EnrichmentService],
  exports: [EnrichmentService],
})
export class EnrichmentModule {}
