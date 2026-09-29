import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ESTABLISHMENT_CATEGORIES,
  type EstablishmentCategory,
} from '../database/schema/establishments.js';
import { DEPARTMENT_PATTERN } from '../establishments/postal-department.js';
import { CreateEstablishmentDto } from '../establishments/dto/create-establishment.dto.js';
import { UpdateEstablishmentDto } from '../establishments/dto/update-establishment.dto.js';
export class CreateProspectDto extends CreateEstablishmentDto {}
export class UpdateProspectDto extends UpdateEstablishmentDto {}
export class PageDto {
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
/*
 * Filters for the référentiel listing.
 *
 * `category`, `department` and `city` are here because the administration screen
 * has to narrow 14,649 establishments and cannot do it in the browser: a page is
 * at most 100 rows, so a filter applied after fetching searches the page and
 * reports nothing for everything else.
 *
 * They are the same three names the dispatch queue and bulk enrolment use, and
 * they resolve through the same shared helper, so "secteur = prospection,
 * département = 974" means one population everywhere rather than three
 * dialects that agree until they don't.
 */
export class ListProspectsDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() regionId?: string;

  @IsOptional() @IsIn(ESTABLISHMENT_CATEGORIES) category?: EstablishmentCategory;

  /* Two digits, or three for the overseas 97x/98x codes. See postal-department.ts. */
  @IsOptional() @Matches(DEPARTMENT_PATTERN) department?: string;

  @IsOptional() @IsString() @MaxLength(32) postalCode?: string;

  @IsOptional() @IsString() @MaxLength(150) city?: string;

  @IsOptional() @IsString() @MaxLength(255) address?: string;

  @IsOptional() @IsIn(['active', 'inactive', 'archived', 'all']) status:
    'active' | 'inactive' | 'archived' | 'all' = 'active';
  @IsOptional() @IsIn(['name', 'createdAt']) sort: 'name' | 'createdAt' = 'name';
  @IsOptional() @IsIn(['asc', 'desc']) direction: 'asc' | 'desc' = 'asc';
}
export class AddressDto {
  @IsOptional() @IsString() @MaxLength(100) label?: string | null;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1!: string;
  @IsOptional() @IsString() @MaxLength(255) line2?: string | null;
  @IsOptional() @IsString() @MaxLength(32) postalCode?: string | null;
  @IsOptional() @IsString() @MaxLength(150) city?: string | null;
  @IsOptional() @IsString() @MaxLength(150) region?: string | null;
  @IsString() @Matches(/^[A-Za-z]{2}$/) countryCode!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() isPrimary?: boolean;
}
export class UpdateAddressDto {
  @IsOptional() @IsString() @MaxLength(100) label?: string | null;
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  line1?: string;
  @IsOptional() @IsString() @MaxLength(255) line2?: string | null;
  @IsOptional() @IsString() @MaxLength(32) postalCode?: string | null;
  @IsOptional() @IsString() @MaxLength(150) city?: string | null;
  @IsOptional() @IsString() @MaxLength(150) region?: string | null;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(/^[A-Za-z]{2}$/) countryCode?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() isPrimary?: boolean;
}
