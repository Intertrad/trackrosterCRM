import { IsUUID } from 'class-validator';

export class AddCampaignProspectDto {
  @IsUUID()
  establishmentId!: string;
}
