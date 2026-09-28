import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
  CAMPAIGN_PROSPECT_LIFECYCLE_STAGES,
  type CampaignProspectLifecycleStage,
} from '../database/schema/campaign-prospects.js';
import {
  ESTABLISHMENT_CATEGORIES,
  type EstablishmentCategory,
} from '../database/schema/establishments.js';
import { DEPARTMENT_PATTERN } from '../establishments/postal-department.js';
import { AssignmentTargetDto } from './assignment-batch.dto.js';
export class CreateAssignmentDto extends AssignmentTargetDto {
  @IsUUID() campaignId!: string;
  @IsUUID() campaignProspectId!: string;
}
export class UpdateAssignmentDto {
  @IsOptional() @IsIn(['active', 'paused']) status?: 'active' | 'paused';
  @IsOptional() @IsIn(['low', 'normal', 'high', 'critical']) priority?:
    'low' | 'normal' | 'high' | 'critical';
}
export class AssignmentEndDto {
  @IsString() @Length(3, 1000) reason!: string;
}
export class ReassignAssignmentDto extends AssignmentTargetDto {
  @IsString() @Length(3, 1000) reason!: string;
}
export class AssignmentListDto {
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() assignedUserId?: string;
  @IsOptional() @IsIn(['active', 'paused', 'completed', 'revoked']) status?:
    'active' | 'paused' | 'completed' | 'revoked';
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
/*
 * What a manager needs in order to choose who to send where.
 *
 * Every filter narrows the same question the endpoint already answered — which
 * prospects in this campaign nobody owns — so they live here rather than in a
 * second endpoint that would have to re-derive availability and could disagree
 * with this one about it.
 *
 * `search` is on the server for a reason: the base is 14,649 establishments and
 * one page is at most 100, so a filter applied in the browser searches the page
 * rather than the campaign and silently finds nothing.
 */
export class UnassignedListDto {
  @IsUUID() campaignId!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;

  @IsOptional() @IsString() @Length(1, 200) search?: string;

  @IsOptional() @IsIn(ESTABLISHMENT_CATEGORIES) category?: EstablishmentCategory;

  @IsOptional() @IsUUID() regionId?: string;

  /*
   * A French department as its postal prefix: two digits, or three for the
   * overseas 97x/98x codes. `2A`/`2B` are rejected on purpose — see
   * postal-department.ts — and Corsica is selected with `20`.
   */
  @IsOptional() @Matches(DEPARTMENT_PATTERN) department?: string;

  @IsOptional() @IsString() @Length(1, 150) city?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_PROSPECT_LIFECYCLE_STAGES)
  lifecycleStage?: CampaignProspectLifecycleStage;

  /*
   * `contactable=true` drops the prospects an opposition covers. It is off by
   * default so the endpoint keeps returning the same rows it always has, but a
   * manager wants it on: the reservation the prospector then tries to take is
   * refused by the same consent check, so dispatching one of these creates work
   * that cannot be carried out.
   */
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  contactable?: boolean;

  /*
   * `unassigned` is this endpoint's long-standing meaning: free inside this
   * campaign. `uncontested` additionally excludes an establishment that another
   * campaign is actively working, which is the collision a manager cannot see
   * from here and would otherwise only discover when the prospector's
   * reservation is refused.
   */
  @IsOptional() @IsIn(['unassigned', 'uncontested']) availability: 'unassigned' | 'uncontested' =
    'unassigned';
}
