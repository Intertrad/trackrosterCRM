import { IsIn } from 'class-validator';

import { User } from '../../database/schema/users.js';

export class UpdateUserStatusDto {
  @IsIn(['active', 'suspended', 'disabled'])
  status!: User['status'];
}
