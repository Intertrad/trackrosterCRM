import type { SelectOption } from '@/components/ui/select-field';

/*
 * The API validates locale with IsLocale and timezone with IsTimeZone, so the
 * lists here only need to offer the values the pilot actually uses. Anything
 * the backend already stores is merged in at render time so an existing value
 * is never silently dropped from the control.
 */
export const LOCALE_OPTIONS: SelectOption[] = [
  { value: 'fr-FR', label: 'French' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' },
];

export const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels (CET)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET)' },
  { value: 'Africa/Casablanca', label: 'Africa/Casablanca (+01)' },
  { value: 'UTC', label: 'UTC' },
];

/** Keeps a stored value selectable even when it is outside the curated list. */
export function withCurrentValue(options: SelectOption[], value: string): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }

  return [{ value, label: value }, ...options];
}
