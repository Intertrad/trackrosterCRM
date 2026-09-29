import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
export class ListCampaignsDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() organizationId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() territoryId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['draft', 'active', 'paused', 'completed', 'archived'])
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(120) search?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsISO8601({ strict: true }) startsAfter?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsISO8601({ strict: true }) startsBefore?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['name', 'createdAt']) sort?: 'name' | 'createdAt';
  @ValidateIf((_o, v) => v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
