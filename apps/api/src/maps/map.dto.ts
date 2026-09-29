import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { campaignProspectLifecycleStageEnum } from '../database/schema/campaign-prospects.js';
export class ProspectMapFiltersDto {
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() territoryId?: string;
  @IsOptional() @IsIn(campaignProspectLifecycleStageEnum.enumValues) lifecycleStage?: string;
  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'completed', 'archived'])
  campaignStatus?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}
export class MapViewportDto extends ProspectMapFiltersDto {
  @IsString() @MaxLength(160) bbox!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(20) zoom = 10;
}
export class NearbyProspectsDto extends ProspectMapFiltersDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50000) radiusMeters = 5000;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
  @IsOptional() @IsUUID() cursor?: string;
}
export class MapAggregateDto extends MapViewportDto {
  @IsOptional() @IsDateString({ strict: true }) from?: string;
  @IsOptional() @IsDateString({ strict: true }) to?: string;
}
export class MapCollisionDto extends MapViewportDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(168) lookbackHours = 24;
}
export class HeatmapDto extends MapAggregateDto {
  @IsOptional() @IsIn(['activity', 'conversion']) metric: 'activity' | 'conversion' = 'activity';
}
