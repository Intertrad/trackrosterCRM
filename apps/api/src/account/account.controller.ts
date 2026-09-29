import { PermissionService } from '../permissions/permission.service.js';
import { ResourceETagInterceptor } from '../http/resource-etag.js';
import {
  Body,
  Headers,
  UseInterceptors,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  ListSessionsDto,
  SwitchMembershipDto,
  UpdateAccountDto,
  UpdatePreferencesDto,
} from './account.dto.js';
import { AccountService } from './account.service.js';

@Controller('me')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly authService: AuthService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  get(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.account.get(auth);
  }

  @Patch()
  @Idempotent('account.update')
  update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: UpdateAccountDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.account.update(auth, input, ifMatch);
  }

  @Get('memberships')
  memberships(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.account.memberships(auth);
  }

  @Get('permissions')
  permissions(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.permissionService.effective(auth.tenantId, auth.membershipId);
  }

  @Post('active-membership')
  @HttpCode(200)
  switchMembership(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: SwitchMembershipDto,
  ) {
    return this.authService.switchMembership(auth, input.membershipId);
  }

  @Get('preferences')
  preferences(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.account.preferences(auth);
  }

  @Patch('preferences')
  @Idempotent('account.preferences')
  updatePreferences(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: UpdatePreferencesDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    return this.account.updatePreferences(auth, input, ifMatch);
  }

  @Get('sessions')
  sessions(@CurrentAuth() auth: AuthenticatedPrincipal, @Query() query: ListSessionsDto) {
    return this.account.sessions(auth, query);
  }

  @Delete('sessions/others')
  @Idempotent('session.revoke_others')
  revokeOthers(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.account.revokeSessions(auth);
  }

  @Delete('sessions/:sessionId')
  @Idempotent('session.revoke')
  revoke(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.account.revokeSessions(auth, sessionId);
  }
}
