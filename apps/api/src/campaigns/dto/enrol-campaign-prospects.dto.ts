import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

import {
  ESTABLISHMENT_CATEGORIES,
  type EstablishmentCategory,
} from '../../database/schema/establishments.js';
import { DEPARTMENT_PATTERN } from '../../establishments/postal-department.js';

/*
 * The upper bound is the import's own ceiling, so a campaign cannot be filled
 * with more establishments in one request than could have been imported in one
 * file.
 */
export const MAX_ENROLMENT_ROWS = 10_000;

/*
 * Which establishments to enrol into a campaign.
 *
 * The filter vocabulary is deliberately the dispatch queue's: a manager picks a
 * section and a department, sees the count, and enrols exactly that set — the
 * same words on both screens, and the same SQL behind them.
 *
 * At least one selector is required. An empty body would otherwise mean "the
 * entire référentiel", and a 14,649-row campaign created by an accidental empty
 * request is not a mistake the operator would notice quickly. Enrolling the
 * whole base is done one category at a time, as the import is.
 */
export class EnrolCampaignProspectsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENROLMENT_ROWS)
  @ArrayUnique((value) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsUUID('all', { each: true })
  establishmentIds?: string[];

  @IsOptional() @IsString() @Length(1, 200) search?: string;

  @IsOptional() @IsIn(ESTABLISHMENT_CATEGORIES) category?: EstablishmentCategory;

  /* Two digits, or three for the overseas 97x/98x codes. See postal-department.ts. */
  @IsOptional() @Matches(DEPARTMENT_PATTERN) department?: string;

  @IsOptional() @IsString() @Length(1, 150) city?: string;

  @IsOptional() @IsUUID() regionId?: string;

  /*
   * How many to enrol, not how many match. The response always reports both, so
   * a set larger than this is reported as truncated rather than quietly halved.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ENROLMENT_ROWS)
  limit = 1_000;
}
