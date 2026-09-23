import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
export const OBJECTIVE_METRICS = [
  'completed_actions',
  'completed_visits',
  'qualified_prospects',
  'converted_prospects',
  'completed_follow_ups',
] as const;
export class CreateObjectiveDto {
  @IsUUID() organizationId!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() teamId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() campaignId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() ownerId?: string;
  @IsString() @Matches(/\S/) @MaxLength(255) name!: string;
  @IsIn(OBJECTIVE_METRICS) metric!: (typeof OBJECTIVE_METRICS)[number];
  @IsInt() @Min(1) @Max(10000000) target!: number;
  @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
}
export class UpdateObjectiveDto {
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/\S/) @MaxLength(255) name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(1) @Max(10000000) target?: number;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string;
}
export class ObjectiveListDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() organizationId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() teamId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() campaignId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() ownerId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
