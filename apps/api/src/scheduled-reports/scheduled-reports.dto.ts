import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/* See the note in saved-views.dto.ts: a class is what enables validation. */

export const REPORT_KEYS = [
  'overview',
  'workload',
  'actions',
  'funnel',
  'conversions',
  'follow-ups',
  'coverage',
  'collisions',
  'data-quality',
  'territories',
  'forecast',
] as const;

export const CADENCES = ['daily', 'weekly', 'monthly'] as const;

export const FORMATS = ['csv', 'xlsx', 'pdf'] as const;

/*
 * A schedule mails its output, so the recipient list is the blast radius of
 * a mistake. It is bounded and every address is validated.
 */
export const MAX_RECIPIENTS = 50;

export class CreateScheduledReportDto {
  @IsIn(REPORT_KEYS) reportKey!: (typeof REPORT_KEYS)[number];

  @IsIn(CADENCES) cadence!: (typeof CADENCES)[number];

  @IsIn(FORMATS) format!: (typeof FORMATS)[number];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RECIPIENTS)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @MaxLength(320, { each: true })
  recipients!: string[];

  @IsOptional() @IsObject() filters?: Record<string, unknown>;

  /** IANA zone name; the schedule fires against it. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_+\-/]+$/)
  timezone?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  nextRunAt?: string;
}

export class UpdateScheduledReportDto {
  @IsOptional() @IsIn(CADENCES) cadence?: (typeof CADENCES)[number];

  @IsOptional() @IsIn(FORMATS) format?: (typeof FORMATS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RECIPIENTS)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  @MaxLength(320, { each: true })
  recipients?: string[];

  @IsOptional() @IsObject() filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_+\-/]+$/)
  timezone?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  nextRunAt?: string;
}

export class ListScheduledReportsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;

  @IsOptional() @IsString() @MaxLength(64) cursor?: string;
}
