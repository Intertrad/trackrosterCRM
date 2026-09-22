import { Body, Controller, Delete, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { MfaService } from './mfa.service.js';
import { CurrentAuth } from './current-auth.decorator.js';
import { AuthenticatedPrincipal } from './auth.types.js';
import { MfaEnrollDto, MfaVerifyDto, MfaRecoveryDto, MfaStepUpDto } from './dto/mfa.dto.js';

@Controller('auth/mfa')
@UseGuards(AuthRateLimitGuard)
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
  ) {}

  @Post('enroll')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  enroll(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() body: MfaEnrollDto) {
    return this.mfa.enroll(auth, body.password);
  }
  @Post('verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  verify(@Body() body: MfaVerifyDto) {
    return this.auth.verifyMfa(body.challengeToken, body.code);
  }
  @Post('recovery')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  recovery(@Body() body: MfaRecoveryDto) {
    return this.auth.verifyMfa(body.challengeToken, body.code, true);
  }
  @Post('recovery-codes/regenerate')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  regenerate(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() body: MfaStepUpDto) {
    return this.mfa.regenerate(auth, body.password, body.code);
  }
  @Delete()
  @UseGuards(AuthGuard)
  @HttpCode(204)
  disable(@CurrentAuth() auth: AuthenticatedPrincipal, @Body() body: MfaStepUpDto) {
    return this.mfa.disable(auth, body.password, body.code);
  }
}
