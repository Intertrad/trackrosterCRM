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
import { CreateEstablishmentDto } from '../establishments/dto/create-establishment.dto.js';
import { UpdateEstablishmentDto } from '../establishments/dto/update-establishment.dto.js';
export class CreateProspectDto extends CreateEstablishmentDto {}
export class UpdateProspectDto extends UpdateEstablishmentDto {}
export class PageDto {
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class ListProspectsDto extends PageDto {
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() regionId?: string;
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
