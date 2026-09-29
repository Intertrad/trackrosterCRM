import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  Matches,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
export class AssignmentTargetDto {
  @IsUUID() teamId!: string;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
}
export class DispatchLocationDto {
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
}
export class AssignmentRuleTargetDto extends AssignmentTargetDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, { each: true })
  skills?: string[];
  @IsOptional() @ValidateNested() @Type(() => DispatchLocationDto) location?: DispatchLocationDto;
}
export class AssignmentSelectionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((v) => (typeof v === 'string' ? v.toLowerCase() : v))
  @IsUUID('all', { each: true })
  prospectIds!: string[];
}
export class AssignmentBatchDto extends AssignmentSelectionDto {
  @IsUUID() campaignId!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() assignedUserId?: string | null;
  @IsOptional() @IsUUID() ruleId?: string;
}
export class AssignmentRulePatchDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsIn(['capacity', 'round_robin', 'skill', 'proximity']) strategy?:
    'capacity' | 'round_robin' | 'skill' | 'proximity';
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssignmentRuleTargetDto)
  targets?: AssignmentRuleTargetDto[];
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/, { each: true })
  requiredSkills?: string[];
  @IsOptional() @IsNumber() @Min(0.001) @Max(20040) maxDistanceKm?: number | null;
}
export class CreateAssignmentRuleDto extends AssignmentRulePatchDto {
  @IsUUID() campaignId!: string;
  @IsString() @Length(1, 120) declare name: string;
  @IsIn(['capacity', 'round_robin', 'skill', 'proximity']) declare strategy:
    'capacity' | 'round_robin' | 'skill' | 'proximity';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssignmentRuleTargetDto)
  declare targets: AssignmentRuleTargetDto[];
}
export class AssignmentRuleListDto {
  @IsUUID() campaignId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) offset = 0;
}

export class AssignmentSuggestionDto {
  @IsUUID() ruleId!: string;
  @IsUUID() campaignProspectId!: string;
}
