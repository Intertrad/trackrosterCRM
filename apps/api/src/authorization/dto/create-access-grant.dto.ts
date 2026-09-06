import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { AccessScope, UserRole } from '../../database/schema/user-access-grants.js';

export class CreateAccessGrantDto {
  @IsIn(['client_admin', 'director', 'manager', 'prospector', 'observer'])
  role!: UserRole;

  @IsIn(['tenant', 'organization', 'team'])
  scopeType!: AccessScope;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
