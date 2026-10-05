import type { SelectOption } from '@/components/ui/select-field';

/*
 * The API accepts many locale formats, but the interface only ships English
 * and French translation catalogs today. Keep the language selector aligned
 * with those catalogs so every selectable value changes the interface. A
 * locale already stored by the backend is still merged in at render time so
 * it is never silently dropped from the control.
 */
export const LOCALE_OPTIONS: SelectOption[] = [
  { value: 'fr-FR', label: 'Français' },
  { value: 'en-GB', label: 'English (UK)' },
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
