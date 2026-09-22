import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLocale,
  IsString,
  IsTimeZone,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateAccountDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsLocale()
  @MaxLength(35)
  locale?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsTimeZone()
  @MaxLength(100)
  timezone?: string;
}

export class UpdatePreferencesDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['comfortable', 'compact'])
  density?: 'comfortable' | 'compact';

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  reducedMotion?: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  highContrast?: boolean;
}

export class SwitchMembershipDto {
  @IsUUID()
  membershipId!: string;
}

export class ListSessionsDto {
  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ValidateIf((_, value) => value !== undefined)
  @IsUUID()
  cursor?: string;
}
