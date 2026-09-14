import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import type { RegionStatus, RegionType } from '../../database/schema/regions.js';

export class UpdateRegionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string | null;

  @IsOptional()
  @IsIn(['country', 'administrative', 'city', 'sales_territory'] satisfies RegionType[])
  type?: RegionType;

  /*
   * null explicitly moves the region to the root.
   *
   * undefined means "do not change the parent".
   */
  @IsOptional()
  @IsUUID()
  parentRegionId?: string | null;

  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'] satisfies RegionStatus[])
  status?: RegionStatus;
}
