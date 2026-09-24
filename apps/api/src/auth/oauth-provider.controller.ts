import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { CurrentAuth } from './current-auth.decorator.js';
import type { AuthenticatedPrincipal } from './auth.types.js';
import { OAuthProviderService } from './oauth-provider.service.js';
@Controller('auth/sso')
export class OAuthProviderController {
  constructor(private readonly oauth: OAuthProviderService) {}
  @Get(':provider/start') @UseGuards(AuthGuard) start(
    @Param('provider') provider: 'google' | 'microsoft',
    @CurrentAuth() a: AuthenticatedPrincipal,
  ) {
    return this.oauth.start(provider, a.tenantId, a.membershipId);
  }
  @Get(':provider/callback') callback(
    @Param('provider') provider: 'google' | 'microsoft',
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    return this.oauth.callback(provider, code, state);
  }
  @Post(':provider/refresh') @UseGuards(AuthGuard) refresh(
    @Param('provider') provider: 'google' | 'microsoft',
    @CurrentAuth() a: AuthenticatedPrincipal,
  ) {
    return this.oauth.refresh(provider, a.tenantId, a.membershipId);
  }
}
