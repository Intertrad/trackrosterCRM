import { Transform, Type } from 'class-transformer';
import { IsIn, IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListFollowUpQueueQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;
  @IsOptional()
  @IsIn(['pending', 'due', 'missed', 'completed', 'cancelled', 'all'])
  status?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsUUID() campaignId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  includeCompleted?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
