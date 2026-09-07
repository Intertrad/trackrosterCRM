import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
export class CreateEstablishmentContactDto {
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
}
