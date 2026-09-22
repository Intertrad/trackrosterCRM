import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
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
  @IsOptional() @IsIn(['capacity', 'round_robin']) strategy?: 'capacity' | 'round_robin';
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssignmentTargetDto)
  targets?: AssignmentTargetDto[];
  @IsOptional() @IsInt() @Min(0) @Max(10000) priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateAssignmentRuleDto extends AssignmentRulePatchDto {
  @IsUUID() campaignId!: string;
  @IsString() @Length(1, 120) declare name: string;
  @IsIn(['capacity', 'round_robin']) declare strategy: 'capacity' | 'round_robin';
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AssignmentTargetDto)
  declare targets: AssignmentTargetDto[];
}
export class AssignmentRuleListDto {
  @IsUUID() campaignId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @Type(() => Number) @IsInt() @Min(0) @Max(100000) offset = 0;
}
