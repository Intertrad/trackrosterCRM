import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID, ValidateIf } from 'class-validator';

import {
  PROSPECT_FOLLOW_UP_CATEGORIES,
  PROSPECT_FOLLOW_UP_CHANNELS,
  type ProspectFollowUpCategory,
  type ProspectFollowUpChannel,
} from '../database/schema/prospect-follow-ups.js';

export class CreateProspectFollowUpDto {
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(PROSPECT_FOLLOW_UP_CATEGORIES)
  category?: ProspectFollowUpCategory;

  @IsOptional()
  @IsIn(PROSPECT_FOLLOW_UP_CHANNELS)
  channel?: ProspectFollowUpChannel | null;
}

export class RescheduleProspectFollowUpDto {
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;
}
