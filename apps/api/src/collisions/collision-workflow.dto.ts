import { Type, Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
export class CheckCollisionDto {
  @IsUUID() campaignId!: string;
  @IsUUID() campaignProspectId!: string;
}
export class OverrideReasonDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(10, 1000)
  reason!: string;
}
export class CollisionListDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional()
  @IsIn(['ACTIVE_RESERVATION', 'ACTIVE_ASSIGNMENT', 'PLANNED_ACTION', 'RECENT_CONTACT'])
  reasonCode?: string;
  @IsOptional() @IsIn(['pending', 'approved', 'rejected', 'cancelled']) status?:
    'pending' | 'approved' | 'rejected' | 'cancelled';
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
