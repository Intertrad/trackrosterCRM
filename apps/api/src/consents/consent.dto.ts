import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
export class CreateConsentDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() contactId?: string;
  @IsIn(['all', 'phone', 'email', 'sms', 'visit']) channel!:
    'all' | 'phone' | 'email' | 'sms' | 'visit';
  @IsIn(['allowed', 'blocked', 'unknown']) status!: 'allowed' | 'blocked' | 'unknown';
  @IsString() @MaxLength(2000) @Matches(/\S/) reason!: string;
  @ValidateIf((_o, v) => v !== undefined) @IsObject() evidence?: Record<string, string>;
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  effectiveAt?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  expiresAt?: string | null;
}
export class ListConsentsDto {
  @ValidateIf((_o, v) => v !== undefined) @IsUUID() cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
