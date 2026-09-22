import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class UpdateActionDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  subject?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsString() @MaxLength(10000) notes?:
    string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dueAt?: string | null;
}
export class CreateActionDto extends UpdateActionDto {
  @IsUUID() campaignId!: string;
  @IsUUID() campaignProspectId!: string;
  @IsIn(['call', 'email', 'message', 'visit', 'task', 'note']) type!:
    'call' | 'email' | 'message' | 'visit' | 'task' | 'note';
  @IsString() @Matches(/\S/) @MaxLength(255) declare subject: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() assigneeMembershipId?: string;
}
export class StartActionDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() overrideId?: string;
}
export class ContactUpdateDto {
  @IsUUID() contactId!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/\S/) @MaxLength(255) name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsEmail() @MaxLength(320) email?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Matches(/\S/) @MaxLength(50) phone?: string;
}
export class NextFollowUpDto {
  @IsISO8601({ strict: true }) @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) dueAt!: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['call', 'email', 'message', 'visit', 'letter'])
  channel?: 'call' | 'email' | 'message' | 'visit' | 'letter';
}
export const OUTCOMES = [
  'no_answer',
  'contacted',
  'interested',
  'not_interested',
  'qualified',
  'converted',
  'do_not_contact',
  'completed',
] as const;
export class CompleteActionDto {
  @IsIn(OUTCOMES) outcomeCode!: (typeof OUTCOMES)[number];
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(10000) notes?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['to_contact', 'contact_made', 'in_progress', 'follow_up', 'qualified', 'converted'])
  lifecycleStage?:
    'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';
  @ValidateIf((_o, v) => v !== undefined)
  @ValidateNested()
  @Type(() => ContactUpdateDto)
  contactUpdate?: ContactUpdateDto;
  @ValidateIf((_o, v) => v !== undefined)
  @ValidateNested()
  @Type(() => NextFollowUpDto)
  nextFollowUp?: NextFollowUpDto;
  @IsIn(['keep', 'release']) reservationDisposition: 'keep' | 'release' = 'release';
}
export class ReasonDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) reason!: string;
}
export class CorrectionDto extends ReasonDto {
  @IsString() @Matches(/\S/) @MaxLength(10000) notes!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(OUTCOMES) outcomeCode?: (typeof OUTCOMES)[number];
}
export class ListActionsDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() campaignId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() assigneeMembershipId?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['planned', 'started', 'completed', 'cancelled'])
  status?: 'planned' | 'started' | 'completed' | 'cancelled';
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
