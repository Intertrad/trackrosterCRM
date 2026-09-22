import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
export class CreateRelationshipDto {
  @IsUUID() parentOrganizationId!: string;
  @IsUUID() childOrganizationId!: string;
  @IsIn(['parent', 'brand', 'partner', 'coordination']) relationshipType!:
    'parent' | 'brand' | 'partner' | 'coordination';
}
export class ListRelationshipsDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() organizationId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['parent', 'brand', 'partner', 'coordination'])
  relationshipType?: 'parent' | 'brand' | 'partner' | 'coordination';
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsIn(['active', 'ended', 'all']) state: 'active' | 'ended' | 'all' = 'active';
}
export class UpdateRosterDto {
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['manager', 'member']) teamRole?:
    'manager' | 'member';
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  startsAt?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  endsAt?: string | null;
}
export class CreateRosterDto extends UpdateRosterDto {
  @IsUUID() membershipId!: string;
}
export class RosterTargetDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() periodId?: string;
}
export class ListRosterDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() membershipId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsIn(['all', 'active', 'scheduled', 'ended', 'revoked']) state:
    'all' | 'active' | 'scheduled' | 'ended' | 'revoked' = 'all';
}
