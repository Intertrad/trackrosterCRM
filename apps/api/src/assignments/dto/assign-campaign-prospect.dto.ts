import { IsOptional, IsUUID } from 'class-validator';

export class AssignCampaignProspectDto {
  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}
