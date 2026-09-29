import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

import { campaignStatusEnum } from '../../database/schema/campaigns.js';

export class UpdateCampaignDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(campaignStatusEnum.enumValues)
  status?: (typeof campaignStatusEnum.enumValues)[number];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;
}
