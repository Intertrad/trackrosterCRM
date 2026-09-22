import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator';
export class CreateCampaignOrganizationDto {
  @IsUUID() organizationId!: string;
  @IsIn(['participate', 'read_only']) accessMode: 'participate' | 'read_only' = 'participate';
}
export class UpdateCampaignOrganizationDto {
  @IsIn(['participate', 'read_only']) accessMode!: 'participate' | 'read_only';
}
export class ListCampaignOrganizationsDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsIn(['active', 'ended', 'all']) state: 'active' | 'ended' | 'all' = 'active';
}
