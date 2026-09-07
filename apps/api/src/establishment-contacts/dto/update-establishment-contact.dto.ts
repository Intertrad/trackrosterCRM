import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import type { EstablishmentContactStatus } from '../../database/schema/establishment-contacts.js';
import { Transform } from 'class-transformer';

export class UpdateEstablishmentContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'] satisfies EstablishmentContactStatus[])
  status?: EstablishmentContactStatus;
}
