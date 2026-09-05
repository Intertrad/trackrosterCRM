import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { AuthenticatedUser, AuthenticationTokens } from './auth.types.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentAuth } from './current-auth.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() input: LoginDto): Promise<AuthenticationTokens> {
    return this.authService.login(input);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() input: RefreshTokenDto): Promise<AuthenticationTokens> {
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
    auth: AuthenticatedUser,
  ): AuthenticatedUser {
    return auth;
  }
}
