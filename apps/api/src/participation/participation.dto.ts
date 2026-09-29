import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
class EffectiveDatesDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string | null;
}
class ParticipantDto extends EffectiveDatesDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() membershipId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() teamId?: string;
}
export class CreateTerritoryAssignmentDto extends ParticipantDto {
  @IsUUID() territoryId!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(0) @Max(100000) priority?: number;
}
export class UpdateTerritoryAssignmentDto extends EffectiveDatesDto {
  @ValidateIf((_o, v) => v !== undefined) @IsInt() @Min(0) @Max(100000) priority?: number;
}
export class CreateCampaignMemberDto extends ParticipantDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['member', 'coordinator', 'observer'])
  campaignRole?: 'member' | 'coordinator' | 'observer';
}
export class UpdateCampaignMemberDto extends EffectiveDatesDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['member', 'coordinator', 'observer'])
  campaignRole?: 'member' | 'coordinator' | 'observer';
}
export class ListParticipationDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() territoryId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() membershipId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() teamId?: string;
  @IsIn(['all', 'active', 'scheduled', 'ended', 'revoked']) state:
    'all' | 'active' | 'scheduled' | 'ended' | 'revoked' = 'all';
}
