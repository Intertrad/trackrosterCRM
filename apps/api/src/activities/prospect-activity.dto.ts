import { IsIn } from 'class-validator';

import {
  prospectActivityTypeEnum,
  type ProspectActivityType,
} from '../database/schema/prospect-activities.js';

export class CreateProspectActivityDto {
  @IsIn(prospectActivityTypeEnum.enumValues)
  type!: ProspectActivityType;
}
