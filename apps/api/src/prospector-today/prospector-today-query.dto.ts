import { IsString, IsTimeZone, IsUUID, MaxLength } from 'class-validator';

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: value,
    }).resolvedOptions();

    return true;
  } catch {
    return false;
  }
}

export class ProspectorTodayQueryDto {
  @IsUUID()
  teamId!: string;

  @IsString()
  @MaxLength(100)
  @IsTimeZone()
  timeZone!: string;
}
