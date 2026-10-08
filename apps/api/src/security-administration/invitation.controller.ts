import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthRateLimitGuard } from '../auth/auth-rate-limit.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreatePlatformInvitationDto,
  InvitationTokenDto,
} from './invitation.dto.js';
import { InvitationService } from './invitation.service.js';
import { PlatformAdminGuard } from '../authorization/platform-admin.guard.js';
@Controller('memberships')
@UseGuards(AuthGuard, ClientAdminGuard)
export class MembershipInvitationController {
  constructor(private readonly invitations: InvitationService) {}
  @Post()
  @Idempotent('membership.invite')
  invite(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() input: CreateInvitationDto) {
    return this.invitations.invite(auth, input);
  }
  @Post(':membershipId/resend-invite')
  @Idempotent('membership.resend_invite')
  @HttpCode(200)
  resend(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('membershipId', new ParseUUIDPipe()) id: string,
  ) {
    return this.invitations.resend(auth, id);
  }
}

@Controller('platform/invitations')
@UseGuards(AuthGuard, PlatformAdminGuard)
export class PlatformInvitationController {
  constructor(private readonly invitations: InvitationService) {}

  @Post()
  @Idempotent('platform.super_admin_invite')
  invitePlatformAdmin(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: CreatePlatformInvitationDto,
  ) {
    return this.invitations.invitePlatformAdmin(auth, input);
  }
}
@Controller('invitations')
@UseGuards(AuthRateLimitGuard)
export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}
  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  previewInvitation(@Param() params: InvitationTokenDto) {
    return this.invitations.preview(params.token);
  }
  @Post(':token/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  acceptInvitation(@Param() params: InvitationTokenDto, @Body() input: AcceptInvitationDto) {
    return this.invitations.accept(params.token, input);
  }
}
