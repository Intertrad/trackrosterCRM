import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class MfaEnrollDto {
  @IsString() @MinLength(1) @MaxLength(1024) password!: string;
}
export class MfaVerifyDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) challengeToken!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
export class MfaRecoveryDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) challengeToken!: string;
  @IsString() @Matches(/^[0-9a-f]{32}$/) code!: string;
}
export class MfaStepUpDto extends MfaEnrollDto {
  @IsString() @Matches(/^\d{6}$/) code!: string;
}
