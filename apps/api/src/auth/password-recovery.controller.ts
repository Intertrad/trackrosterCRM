import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
export class ForgotPasswordDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
export class ResetTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
export class ResetPasswordDto extends ResetTokenDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
@Controller('auth')
@UseGuards(AuthRateLimitGuard)
export class PasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService) {}
  @Post('password/forgot')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.recovery.forgot(body.email);
  }
  @Get('password-reset/:token/status')
  @Header('Cache-Control', 'no-store')
  @Header('Referrer-Policy', 'no-referrer')
  resetStatus(@Param() params: ResetTokenDto) {
    return this.recovery.status(params.token);
  }
  @Post('password/reset')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.recovery.reset(body.token, body.password);
  }
}
