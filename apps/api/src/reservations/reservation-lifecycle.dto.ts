import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
export class ReservationRulePatchDto {
  @IsOptional() @IsInt() @Min(1) @Max(240) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10080) cooldownMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(1440) maxHoldMinutes?: number;
  @IsOptional() @IsBoolean() allowHeartbeat?: boolean;
  @IsOptional() @IsBoolean() allowExtension?: boolean;
  @IsOptional() @IsBoolean() allowManagerOverride?: boolean;
}
export class CreateReservationRuleDto extends ReservationRulePatchDto {
  @IsOptional() @IsUUID() campaignId?: string;
}
export class ClaimReservationDto {
  @IsUUID() campaignId!: string;
  @IsUUID() campaignProspectId!: string;
  @IsOptional() @IsUUID() overrideId?: string;
}
export class ExtendReservationDto {
  @IsInt() @Min(1) @Max(240) minutes!: number;
}
export class ReleaseReservationDto {
  @IsString() @Length(3, 1000) reason!: string;
}
export class ReservationListDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional()
  @IsIn(['pending', 'active', 'released', 'expired', 'lost', 'failed'])
  status?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
