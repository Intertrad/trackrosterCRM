import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuditModule } from '../audit/audit.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstablishmentModule } from '../establishments/establishment.module.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { ProspectAccessService } from './prospect-access.service.js';
import { ProspectMasterService } from './prospect-master.service.js';
import {
  AddressDto,
  CreateProspectDto,
  ListProspectsDto,
  PageDto,
  UpdateAddressDto,
  UpdateProspectDto,
} from './prospect-master.dto.js';
import { CreateEstablishmentContactDto } from '../establishment-contacts/dto/create-establishment-contact.dto.js';
import { UpdateEstablishmentContactDto } from '../establishment-contacts/dto/update-establishment-contact.dto.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class ProspectWriteGuard implements CanActivate {
  constructor(private readonly service: ProspectMasterService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c
        .switchToHttp()
        .getRequest<{ auth: AuthenticatedPrincipal; params: Record<string, string> }>();
      for (const v of Object.values(r.params))
        if (!isUUID(v)) throw new BadRequestException('Invalid resource identifier');
      if (r.params.prospectId)
        await this.service.access.prospect(r.auth, r.params.prospectId, true);
      else if (r.params.addressId)
        await this.service.childParent(r.auth, 'address', r.params.addressId, true);
      else if (r.params.contactId)
        await this.service.childParent(r.auth, 'contact', r.params.contactId, true);
      else await this.service.access.admin(r.auth);
      return true;
    });
  }
}
@Controller('prospects')
@UseGuards(AuthGuard)
export class ProspectMasterController {
  constructor(private readonly service: ProspectMasterService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: ListProspectsDto) {
    return this.service.list(a, q);
  }
  @Post()
  @UseGuards(ProspectWriteGuard)
  @Idempotent('prospect.create')
  @UseInterceptors(ResourceETagInterceptor)
  create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() d: CreateProspectDto) {
    return this.service.create(a, d);
  }
  @Get(':prospectId')
  @UseInterceptors(ResourceETagInterceptor)
  get(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.get(a, id);
  }
  @Patch(':prospectId')
  @UseGuards(ProspectWriteGuard)
  @UseInterceptors(ResourceETagInterceptor)
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateProspectDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.update(a, id, d, v);
  }
  @Delete(':prospectId')
  @UseGuards(ProspectWriteGuard)
  @HttpCode(204)
  async archive(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    await this.service.update(a, id, {}, v, 'archived');
  }
  @Post(':prospectId/restore')
  @UseGuards(ProspectWriteGuard)
  @HttpCode(200)
  @UseInterceptors(ResourceETagInterceptor)
  restore(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.update(a, id, {}, v, 'active');
  }
  @Get(':prospectId/addresses') addresses(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Query() q: PageDto,
  ) {
    return this.service.children(a, id, 'address', q);
  }
  @Post(':prospectId/addresses')
  @UseGuards(ProspectWriteGuard)
  @Idempotent('prospect_address.create')
  @UseInterceptors(ResourceETagInterceptor)
  address(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Body() d: AddressDto,
  ) {
    return this.service.address(a, id, undefined, d);
  }
  @Get(':prospectId/contacts') contacts(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Query() q: PageDto,
  ) {
    return this.service.children(a, id, 'contact', q);
  }
  @Post(':prospectId/contacts')
  @UseGuards(ProspectWriteGuard)
  @Idempotent('prospect_contact.create')
  @UseInterceptors(ResourceETagInterceptor)
  contact(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Body() d: CreateEstablishmentContactDto,
  ) {
    return this.service.contact(a, id, undefined, d);
  }
}
@Controller('prospect-addresses')
@UseGuards(AuthGuard, ProspectWriteGuard)
export class ProspectAddressController {
  constructor(private readonly service: ProspectMasterService) {}
  @Patch(':addressId')
  @UseInterceptors(ResourceETagInterceptor)
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateAddressDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.address(a, undefined, id, d, false, v);
  }
  @Delete(':addressId')
  @HttpCode(204)
  async remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('addressId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    await this.service.address(a, undefined, id, {}, true, v);
  }
}
@Controller('prospect-contacts')
@UseGuards(AuthGuard, ProspectWriteGuard)
export class ProspectContactController {
  constructor(private readonly service: ProspectMasterService) {}
  @Patch(':contactId')
  @UseInterceptors(ResourceETagInterceptor)
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('contactId', new ParseUUIDPipe()) id: string,
    @Body() d: UpdateEstablishmentContactDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.contact(a, undefined, id, d, false, v);
  }
  @Delete(':contactId')
  @HttpCode(204)
  async remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('contactId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    await this.service.contact(a, undefined, id, {}, true, v);
  }
}
@Module({
  imports: [AuthModule, DatabaseModule, AuditModule, EstablishmentModule],
  controllers: [ProspectMasterController, ProspectAddressController, ProspectContactController],
  providers: [ProspectMasterService, ProspectAccessService, ProspectWriteGuard],
  exports: [ProspectMasterService, ProspectAccessService, ProspectWriteGuard],
})
export class ProspectMasterModule {}
