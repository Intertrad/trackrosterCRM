import { IsIn } from 'class-validator';

import { campaignProspectStatusEnum } from '../../database/schema/campaign-prospects.js';

export class UpdateCampaignProspectDto {
  @IsIn(campaignProspectStatusEnum.enumValues)
  status!: (typeof campaignProspectStatusEnum.enumValues)[number];
}
