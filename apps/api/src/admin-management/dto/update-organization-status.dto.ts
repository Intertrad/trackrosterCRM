import { IsIn } from 'class-validator';

import type { Organization } from '../../database/schema/organizations.js';

export class UpdateOrganizationStatusDto {
  @IsIn(['active', 'inactive'])
  status!: Organization['status'];
}
