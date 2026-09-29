import { isRecord } from './client';
import { fieldLabel, text } from './copy';
import type { DataRecord, Field } from './types';

export function validateFields(
  fields: Field[],
  values: DataRecord,
  language: string,
  prefix = '',
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.name];
    const key = prefix + field.name;
    const label = fieldLabel(field.name, language);
    if (value === null && field.nullable) continue;
    if (value === undefined || value === '' || value === null) {
      if (!field.optional)
        errors[key] = text(
          `Enter ${label.toLowerCase()}.`,
          `Renseignez : ${label.toLowerCase()}.`,
          language,
        );
      continue;
    }
    const str = String(value);
    if (field.type === 'number') {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        (field.integer && !Number.isInteger(n)) ||
        (field.min !== undefined && n < field.min) ||
        (field.max !== undefined && n > field.max)
      ) {
        errors[key] = text(
          `Enter a valid number${field.min !== undefined ? `, at least ${field.min}` : ''}${field.max !== undefined ? `, at most ${field.max}` : ''}.`,
          `Saisissez un nombre valide${field.min !== undefined ? `, minimum ${field.min}` : ''}${field.max !== undefined ? `, maximum ${field.max}` : ''}.`,
          language,
        );
      }
    }
    if (field.type === 'date' && !Number.isFinite(new Date(str).getTime()))
      errors[key] = text(
        'Enter a valid date and time.',
        'Saisissez une date et une heure valides.',
        language,
      );
    if (field.type === 'string') {
      if (field.minLength !== undefined && str.trim().length < field.minLength)
        errors[key] = text(
          `Use at least ${field.minLength} characters.`,
          `Utilisez au moins ${field.minLength} caractères.`,
          language,
        );
      if (field.maxLength !== undefined && str.length > field.maxLength)
        errors[key] = text(
          `Use at most ${field.maxLength} characters.`,
          `Utilisez au maximum ${field.maxLength} caractères.`,
          language,
        );
      if (
        field.format === 'uuid' &&
        !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(str)
      )
        errors[key] = text(
          'Choose a valid record.',
          'Choisissez un enregistrement valide.',
          language,
        );
      if (field.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str))
        errors[key] = text(
          'Enter a valid email address.',
          'Saisissez une adresse e-mail valide.',
          language,
        );
      if (field.format === 'url') {
        try {
          if (!['http:', 'https:'].includes(new URL(str).protocol)) throw new Error();
        } catch {
          errors[key] = text(
            'Enter a complete HTTP or HTTPS address.',
            'Saisissez une adresse HTTP ou HTTPS complète.',
            language,
          );
        }
      }
    }
    if (field.choices && !field.choices.includes(str))
      errors[key] = text(
        'Choose an available option.',
        'Choisissez une option disponible.',
        language,
      );
    if (field.type === 'object' && !isRecord(value))
      errors[key] = text('Enter a valid object.', 'Saisissez un objet valide.', language);
    if (field.fields && isRecord(value))
      Object.assign(errors, validateFields(field.fields, value, language, `${key}.`));
    if (field.type === 'array') {
      if (
        Array.isArray(value) &&
        ((field.minItems !== undefined && value.length < field.minItems) ||
          (field.maxItems !== undefined && value.length > field.maxItems))
      )
        errors[key] = text(
          `Use ${field.minItems ?? 0} to ${field.maxItems ?? 'many'} entries.`,
          `Utilisez ${field.minItems ?? 0} à ${field.maxItems ?? 'plusieurs'} entrées.`,
          language,
        );
      if (!Array.isArray(value))
        errors[key] = text('Add at least one value.', 'Ajoutez au moins une valeur.', language);
      else
        value.forEach((item, i) => {
          if (field.item)
            Object.assign(
              errors,
              validateFields(
                [{ ...field.item, name: String(i), optional: false }],
                { [i]: item },
                language,
                `${key}.`,
              ),
            );
        });
    }
  }
  return errors;
}
