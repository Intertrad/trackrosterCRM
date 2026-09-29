import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TENANT_ROLES, type TenantRole } from '../permissions/permission-catalogue.js';
export class ListMembershipsDto {
  @IsOptional() @IsUUID() territoryId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsIn(TENANT_ROLES) role?: TenantRole;
  @IsOptional() @IsIn(['invited', 'active', 'suspended', 'departed']) status?:
    'invited' | 'active' | 'suspended' | 'departed';
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}
export class MembershipReasonDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
export class MembershipScopeDto {
  @IsOptional() @IsIn(['allow', 'deny']) effect?: 'allow' | 'deny';
  @IsOptional() @IsString() @MinLength(3) @MaxLength(1000) reason?: string;
  @IsOptional() @IsUUID() territoryId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsIn(['read', 'read_write', 'manage']) accessLevel?:
    'read' | 'read_write' | 'manage';
  @ValidateIf((input: MembershipScopeDto) => input.effect !== 'deny')
  @IsIn(TENANT_ROLES)
  role!: TenantRole;
  @IsIn(['tenant', 'organization', 'team', 'territory', 'campaign']) scopeType!:
    'tenant' | 'organization' | 'team' | 'territory' | 'campaign';
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() teamId?: string;
}
export class UpdateMembershipDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(100000)
  capacity?: number | null;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['active', 'suspended', 'departed'])
  status?: 'active' | 'suspended' | 'departed';
  @ValidateIf((_object, value) => value !== undefined) @IsIn(TENANT_ROLES) role?: TenantRole;
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['tenant', 'organization', 'team'])
  scopeType?: 'tenant' | 'organization' | 'team';
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() organizationId?: string;
  @ValidateIf((_object, value) => value !== undefined) @IsUUID() teamId?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}
