import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/*
 * As in the messaging module: an `any` or type-literal @Body() carries no
 * runtime metatype, so the global ValidationPipe skips the handler and
 * neither `whitelist` nor `forbidNonWhitelisted` applies. Declaring classes
 * is what turns those settings back on for these routes.
 */

/** Matches the presign guard and the attachment column widths. */
export const MAX_UPLOAD_BYTES = 25_000_000;

export class PresignUploadDto {
  @IsString() @MinLength(1) @MaxLength(255) filename!: string;

  @IsString() @MinLength(1) @MaxLength(120) contentType!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) byteSize!: number;
}

export class AttachUploadDto {
  /*
   * The object key is produced by presign and is always prefixed with the
   * caller's tenant id; `attach` re-checks that prefix before inserting.
   */
  @IsString() @MinLength(1) @MaxLength(500) objectKey!: string;

  @IsString() @MinLength(1) @MaxLength(255) filename!: string;

  @IsString() @MinLength(1) @MaxLength(120) contentType!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(MAX_UPLOAD_BYTES) byteSize!: number;
}

export class RegisterDeviceDto {
  @IsString() @MinLength(1) @MaxLength(512) token!: string;

  @IsIn(['ios', 'android', 'web']) platform!: 'ios' | 'android' | 'web';
}

/** One notification channel set. Unknown channels are rejected. */
export class NotificationChannelDto {
  @IsOptional() @IsBoolean() email?: boolean;

  @IsOptional() @IsBoolean() push?: boolean;

  @IsOptional() @IsBoolean() inApp?: boolean;
}

/*
 * Preferences were previously stored as an arbitrary JSON blob. The
 * categories are enumerated so the stored document stays a known shape and
 * cannot be used as unbounded per-user storage.
 */
export class NotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  assignments?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  followUps?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  collisions?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  overrides?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  messages?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  imports?: NotificationChannelDto;

  /** Safety categories are always visible in-app. */
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  opposition?: NotificationChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  security?: NotificationChannelDto;
}

/*
 * Digest cadence and timezone are deliberately absent: the
 * notification_preferences column stores a map of channel objects, so adding
 * scalar keys here would need a migration rather than a wider DTO.
 */

export const NOTIFICATION_CATEGORIES = [
  'assignments',
  'followUps',
  'collisions',
  'overrides',
  'messages',
  'imports',
  'opposition',
  'security',
] as const;

/**
 * Collision alerts are a safety boundary, rather than an optional feed.
 * Keep their in-app channel enabled even when an older client submits a
 * preference document with that flag set to false (CR-033).
 */
export function normalizeNotificationPreferences(
  preferences: NotificationPreferencesDto,
): NotificationPreferencesDto {
  return {
    ...preferences,
    ...(preferences.collisions ? { collisions: { ...preferences.collisions, inApp: true } } : {}),
    ...(preferences.opposition ? { opposition: { ...preferences.opposition, inApp: true } } : {}),
    ...(preferences.security ? { security: { ...preferences.security, inApp: true } } : {}),
  };
}
