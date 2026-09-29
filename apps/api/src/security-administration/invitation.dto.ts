import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
export class CreateInvitationDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
  @IsIn(['tenant_admin', 'director', 'manager', 'prospector', 'auditor']) role!:
    'tenant_admin' | 'director' | 'manager' | 'prospector' | 'auditor';
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;
}
export class AcceptInvitationDto {
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @Matches(/^\d{6}$/) mfaCode?: string;
}
export class InvitationTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
}
