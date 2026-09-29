import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PageDto } from '../prospect-master/prospect-master.dto.js';
export class TagDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string | null;
}
export class UpdateTagDto {
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string | null;
}
export class FieldValidationDto {
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() required?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsNumber() min?: number;
  @ValidateIf((_, v) => v !== undefined) @IsNumber() max?: number;
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options?: string[];
}
export class FieldVisibilityDto {
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsIn(['tenant_admin', 'director', 'manager', 'prospector', 'auditor'], { each: true })
  roles?: string[];
}
export class FieldDto {
  @Matches(/^[a-z][a-z0-9_]{0,63}$/) fieldKey!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label!: string;
  @IsIn(['text', 'number', 'date', 'boolean', 'select', 'multi_select', 'json']) dataType!: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => FieldValidationDto)
  validation?: FieldValidationDto;
  @ValidateIf((_, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => FieldVisibilityDto)
  visibility?: FieldVisibilityDto;
}
export class UpdateFieldDto {
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => FieldValidationDto)
  validation?: FieldValidationDto;
  @ValidateIf((_, v) => v !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => FieldVisibilityDto)
  visibility?: FieldVisibilityDto;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() isActive?: boolean;
}
export class FieldValuesDto {
  @IsObject() values!: Record<string, unknown>;
}
export class DuplicateQueryDto extends PageDto {
  @IsOptional() @IsIn(['pending', 'not_duplicate', 'merged', 'all']) resolution = 'pending';
}
export class ResolveDuplicateDto {
  @IsIn(['not_duplicate', 'merged']) resolution!: string;
  @IsOptional() @IsUUID() targetId?: string;
}
