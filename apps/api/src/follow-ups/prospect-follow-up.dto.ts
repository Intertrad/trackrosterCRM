import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class CreateProspectFollowUpDto {
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string | null;
}

export class RescheduleProspectFollowUpDto {
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;
}
