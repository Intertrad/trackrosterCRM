import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsLocale,
  IsString,
  IsTimeZone,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const optional = (_: unknown, value: unknown) => value !== undefined;

export class ListWorkspaceResourcesDto {
  @ValidateIf(optional) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @ValidateIf(optional) @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(100) search?: string;
}

export class ListTeamsDto extends ListWorkspaceResourcesDto {
  @ValidateIf(optional) @IsUUID() organizationId?: string;
}

export class CreateOrganizationDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @Transform(trim) @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(100) shortName?: string;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(80) phone?: string;
  @ValidateIf(optional) @Transform(trim) @IsEmail() @MaxLength(320) email?: string;
  @ValidateIf(optional)
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(2000) address?: string;
  @ValidateIf(optional) @Transform(trim) @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @ValidateIf(optional) @Transform(trim) @Matches(/^[A-Za-z]{3}$/) currency?: string;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(5000) argumentaire?: string;
  @ValidateIf(optional)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  prospectedSectors?: string[];
}

export class UpdateOrganizationDto {
  @ValidateIf(optional) @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @ValidateIf(optional)
  @Transform(trim)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug?: string;
  @ValidateIf(optional) @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(100) shortName?: string | null;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(80) phone?: string | null;
  @ValidateIf(optional) @Transform(trim) @IsEmail() @MaxLength(320) email?: string | null;
  @ValidateIf(optional)
  @Transform(trim)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  website?: string | null;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(2000) address?: string | null;
  @ValidateIf(optional) @Transform(trim) @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string | null;
  @ValidateIf(optional) @Transform(trim) @Matches(/^[A-Za-z]{3}$/) currency?: string | null;
  @ValidateIf(optional) @Transform(trim) @IsString() @MaxLength(5000) argumentaire?: string | null;
  @ValidateIf(optional)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  prospectedSectors?: string[];
}

export class CreateTeamDto extends CreateOrganizationDto {
  @IsUUID() organizationId!: string;
  @ValidateIf(optional) @IsInt() @Min(1) @Max(100000) capacity?: number;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID() managerMembershipId?:
    string | null;
}

export class UpdateTeamDto extends UpdateOrganizationDto {
  @ValidateIf(optional) @IsInt() @Min(1) @Max(100000) capacity?: number;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID() managerMembershipId?:
    string | null;
}

export class UpdateTenantDto {
  @ValidateIf(optional) @Transform(trim) @IsString() @MinLength(1) @MaxLength(255) name?: string;
  @ValidateIf(optional) @IsLocale() @MaxLength(35) locale?: string;
  @ValidateIf(optional) @IsTimeZone() @MaxLength(100) timezone?: string;
}
