import { IsUUID } from 'class-validator';

export class GetWorkQueueOptionsQueryDto {
  @IsUUID()
  teamId!: string;
}
