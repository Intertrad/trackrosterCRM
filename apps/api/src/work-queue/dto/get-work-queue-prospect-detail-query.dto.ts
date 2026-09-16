import { IsUUID } from 'class-validator';

export class GetWorkQueueProspectDetailQueryDto {
  @IsUUID()
  teamId!: string;
}
