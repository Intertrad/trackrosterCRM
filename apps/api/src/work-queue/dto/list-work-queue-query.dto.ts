import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import {
  campaignProspectLifecycleStageEnum,
  type CampaignProspectLifecycleStage,
} from '../../database/schema/campaign-prospects.js';

export class ListWorkQueueQueryDto {
  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsIn(campaignProspectLifecycleStageEnum.enumValues)
  lifecycleStage?: CampaignProspectLifecycleStage;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string' || value.trim() === '') {
      return value;
    }

    return Number(value);
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
