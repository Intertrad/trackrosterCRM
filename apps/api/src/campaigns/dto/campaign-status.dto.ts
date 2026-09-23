import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CampaignStatus } from '../../database/schema/campaigns.js';
export class CampaignStatusDto {
  @IsIn(['active', 'paused', 'completed', 'archived']) status!: CampaignStatus;
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}
