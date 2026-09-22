import { ConfigService } from '@nestjs/config';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { AuthenticatedPrincipal, AuthenticatedUser, AuthenticationResult } from './auth.types.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentAuth } from './current-auth.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SelectWorkspaceDto } from './dto/select-workspace.dto.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  configuration() {
    return {
      password: true,
      mfa: {
        totp: !!this.config.get('MFA_ENCRYPTION_KEY'),
        recoveryCodes: !!this.config.get('MFA_ENCRYPTION_KEY'),
      },
      passwordRecovery: !!this.config.get('MAILPIT_URL'),
      sso: { enabled: false },
    };
  }

  @Header('Cache-Control', 'no-store')
  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto): Promise<AuthenticationResult> {
    return this.authService.login(input);
  }

  @Header('Cache-Control', 'no-store')
  @Post('select-tenant')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  selectTenant(@Body() input: SelectWorkspaceDto) {
    return this.authService.selectMembership(input.selectionToken, input.membershipId);
  }

  @Header('Cache-Control', 'no-store')
  @Post('refresh')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() input: RefreshTokenDto) {
    return this.authService.refresh(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() input: RefreshTokenDto): Promise<void> {
    await this.authService.logout(input.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  getCurrentUser(
    @CurrentAuth()
    auth: AuthenticatedPrincipal,
  ): AuthenticatedUser {
    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
    };
  }
}
