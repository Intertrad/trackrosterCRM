import { IsIn } from 'class-validator';

import type { Team } from '../../database/schema/teams.js';

export class UpdateTeamStatusDto {
  @IsIn(['active', 'inactive'])
  status!: Team['status'];
}
