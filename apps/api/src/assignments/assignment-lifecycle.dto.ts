import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
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
export class UnassignedListDto {
  @IsUUID() campaignId!: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
