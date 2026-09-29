import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import { MembershipService } from './membership.service.js';
import {
  ListMembershipsDto,
  MembershipReasonDto,
  MembershipScopeDto,
  UpdateMembershipDto,
} from './membership.dto.js';
@Controller('memberships')
@UseGuards(AuthGuard, ClientAdminGuard)
@UseInterceptors(ResourceETagInterceptor)
export class MembershipController {
  constructor(private readonly memberships: MembershipService) {}
  @Get() list(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListMembershipsDto) {
    return this.memberships.list(auth, query);
  }
  @Get(':membershipId') get(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
  ) {
    return this.memberships.get(auth, id);
  }
  @Patch(':membershipId')
  @Idempotent('membership.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateMembershipDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.memberships.update(auth, id, input, ifMatch);
  }
  @Post(':membershipId/suspend')
  @HttpCode(200)
  @Idempotent('membership.suspend')
  suspend(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
    @Body() input: MembershipReasonDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.memberships.update(
      auth,
      id,
      { status: 'suspended', reason: input.reason },
      ifMatch,
    );
  }
  @Post(':membershipId/reactivate')
  @HttpCode(200)
  @Idempotent('membership.reactivate')
  reactivate(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
    @Body() input: MembershipReasonDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.memberships.update(auth, id, { status: 'active', reason: input.reason }, ifMatch);
  }
  @Get(':membershipId/scopes') scopes(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
  ) {
    return this.memberships.scopes(auth, id);
  }
  @Post(':membershipId/scopes')
  @Idempotent('membership.add_scope')
  addScope(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
    @Body() input: MembershipScopeDto,
  ) {
    return this.memberships.addScope(auth, id, input);
  }
  @Get(':membershipId/access-history') history(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
    @Query() query: ListMembershipsDto,
  ) {
    return this.memberships.history(auth, id, query);
  }
}
@Controller('membership-scopes')
@UseGuards(AuthGuard, ClientAdminGuard)
@UseInterceptors(ResourceETagInterceptor)
export class MembershipScopeController {
  constructor(private readonly memberships: MembershipService) {}
  @Patch(':scopeId')
  @Idempotent('membership.change_scope')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scopeId', new ParseUUIDPipe()) id: string,
    @Body() input: MembershipScopeDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.memberships.changeScope(auth, id, input, ifMatch);
  }
  @Delete(':scopeId')
  @HttpCode(204)
  @Idempotent('membership.remove_scope')
  remove(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('scopeId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.memberships.changeScope(auth, id, null, ifMatch);
  }
}
