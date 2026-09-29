import { IsIn, IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class PlatformTenantStatusDto {
  @IsIn(['active', 'suspended', 'inactive'])
  status!: 'active' | 'suspended' | 'inactive';
}

export class PlatformTenantConfigDto {
  @IsObject()
  config!: Record<string, unknown>;
}

export class PlatformTenantReasonDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}
