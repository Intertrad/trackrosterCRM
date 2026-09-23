import { Transform, Type } from 'class-transformer';
import { IsIn, IsBoolean, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional() @IsIn(['info', 'warning', 'error', 'critical']) severity?:
    'info' | 'warning' | 'error' | 'critical';
  @IsOptional() @IsIn(['read', 'unread', 'all']) readState?: 'read' | 'unread' | 'all';
  @IsOptional()
  @IsUUID()
  cursor?: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
