import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/*
 * A class, not a type literal.
 *
 * An `any` or inline type on @Body() carries no runtime metatype, so Nest
 * skips validation for the handler entirely and neither `whitelist` nor
 * `forbidNonWhitelisted` applies. Declaring the shape is what turns the
 * global pipe back on for these routes.
 */

export const SAVED_VIEW_RESOURCES = [
  'prospects',
  'campaigns',
  'activities',
  'follow-ups',
  'assignments',
  'routes',
] as const;

export type SavedViewResource = (typeof SAVED_VIEW_RESOURCES)[number];

export const MAX_SAVED_VIEW_NAME = 120;

/** A column list long enough for any real grid, short enough to bound the row. */
export const MAX_SAVED_VIEW_COLUMNS = 100;

export class CreateSavedViewDto {
  @IsIn(SAVED_VIEW_RESOURCES) resource!: SavedViewResource;

  @IsString() @MinLength(1) @MaxLength(MAX_SAVED_VIEW_NAME) name!: string;

  /*
   * Filters and sort are caller-defined documents, so their keys cannot be
   * enumerated here. They are still bounded to objects rather than accepting
   * an array or a scalar, which the previous `any` did.
   */
  @IsObject() filters!: Record<string, unknown>;

  /* The sort column stores a field -> direction map, so string values. */
  @IsOptional() @IsObject() sort?: Record<string, string>;

  @IsArray()
  @ArrayMaxSize(MAX_SAVED_VIEW_COLUMNS)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  columns!: string[];

  @IsOptional() @IsBoolean() @Type(() => Boolean) shared?: boolean;

  @IsOptional() @IsBoolean() @Type(() => Boolean) isDefault?: boolean;
}

export class UpdateSavedViewDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(MAX_SAVED_VIEW_NAME) name?: string;

  @IsOptional() @IsObject() filters?: Record<string, unknown>;

  @IsOptional() @IsObject() sort?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SAVED_VIEW_COLUMNS)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  columns?: string[];

  @IsOptional() @IsBoolean() @Type(() => Boolean) shared?: boolean;

  @IsOptional() @IsBoolean() @Type(() => Boolean) isDefault?: boolean;
}

export class ListSavedViewsDto {
  @IsOptional() @IsIn(SAVED_VIEW_RESOURCES) resource?: SavedViewResource;
}
