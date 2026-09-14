import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import type { RegionType } from '../../database/schema/regions.js';

export class CreateRegionDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string | null;

  @IsIn(['country', 'administrative', 'city', 'sales_territory'] satisfies RegionType[])
  type!: RegionType;

  @IsOptional()
  @IsUUID()
  parentRegionId?: string | null;
}
