import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';

import { CONTROLLED_EXPORT_FORMATS, type ControlledExportFormat } from '../export.types.js';

/*
 * Keep V1 exports deliberately bounded.
 *
 * The service will apply:
 *
 * - a default range when both are omitted
 * - from/to pair validation
 * - from < to
 * - maximum-range validation
 *
 * The DTO is only responsible for parsing and
 * basic type validation.
 */
export class ControlledExportQueryDto {
  @IsOptional()
  @IsIn(CONTROLLED_EXPORT_FORMATS)
  format: ControlledExportFormat = 'csv';

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}
