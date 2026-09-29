'use client';

import { useId, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectField } from '@/components/ui/select-field';
import { SearchInput } from '@/components/ui/search-input';
import { TextField } from '@/components/ui/text-field';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fieldLabel, text } from '@/lib/workspace/copy';
import { isRecord, initialValues } from '@/lib/workspace/client';
import type { DataRecord, Field } from '@/lib/workspace/types';
import { LOOKUPS, RecordPicker } from './record-picker';

export function SchemaFields({
  fields,
  values,
  onChange,
  errors = {},
  prefix = '',
  context = {},
}: {
  fields: Field[];
  values: DataRecord;
  onChange: (values: DataRecord) => void;
  errors?: Record<string, string>;
  prefix?: string;
  context?: DataRecord;
}) {
  const { language } = useTranslation();
  const clearedValues = useRef<DataRecord>({});
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <FieldInput
            field={field}
            context={{ ...context, ...values }}
            value={values[field.name]}
            onChange={(value) => onChange({ ...values, [field.name]: value })}
            errors={errors}
            path={`${prefix}${field.name}`}
          />
          {field.nullable && (
            <Checkbox
              label={text('Clear this value', 'Effacer cette valeur', language)}
              checked={values[field.name] === null}
              onChange={(e) => {
                if (e.target.checked) clearedValues.current[field.name] = values[field.name];
                onChange({
                  ...values,
                  [field.name]: e.target.checked ? null : clearedValues.current[field.name],
                });
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function localDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function FieldInput({
  field,
  value,
  onChange,
  errors,
  path,
  context,
}: {
  field: Field;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: Record<string, string>;
  path: string;
  context: DataRecord;
}) {
  const { language } = useTranslation();
  const id = useId();
  const label = fieldLabel(field.name, language);
  const error = errors[path];
  const optional = field.optional ? text(' (optional)', ' (facultatif)', language) : '';
  const fullLabel = `${label}${optional}`;
  if (field.type === 'object') {
    if (!field.fields)
      return (
        <StructuredField
          label={fullLabel}
          value={value}
          onChange={onChange}
          name={path}
          error={error}
        />
      );
    const enabled = value !== undefined && value !== null;
    return (
      <fieldset className="space-y-4 rounded-xl border border-line p-4">
        <legend className="px-1 font-semibold">{fullLabel}</legend>
        {field.optional && (
          <Checkbox
            label={text(
              `Include ${label.toLowerCase()}`,
              `Inclure : ${label.toLowerCase()}`,
              language,
            )}
            checked={enabled}
            onChange={(e) => onChange(e.target.checked ? initialValues(field.fields!) : undefined)}
          />
        )}
        {(!field.optional || enabled) && (
          <SchemaFields
            context={context}
            fields={field.fields}
            values={isRecord(value) ? value : {}}
            onChange={onChange}
            errors={errors}
            prefix={`${path}.`}
          />
        )}
      </fieldset>
    );
  }
  if (field.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    if (field.item?.fields)
      return (
        <fieldset className="space-y-3 rounded-xl border border-line p-4">
          <legend className="px-1 font-semibold">{fullLabel}</legend>
          {items.map((item, index) => (
            <div key={index} className="space-y-3 border-b border-line-soft pb-4">
              <SchemaFields
                context={context}
                fields={field.item!.fields!}
                values={isRecord(item) ? item : {}}
                errors={errors}
                prefix={`${path}.${index}.`}
                onChange={(next) => onChange(items.map((old, i) => (i === index ? next : old)))}
              />
              <Button
                variant="ghost"
                size="md"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                {text('Remove entry', 'Retirer l’entrée', language)} {index + 1}
              </Button>
            </div>
          ))}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={() => onChange([...items, initialValues(field.item!.fields!)])}
          >
            {text('Add entry', 'Ajouter une entrée', language)}
          </Button>
        </fieldset>
      );
    if (field.item?.choices)
      return (
        <fieldset className="space-y-3">
          <legend className="mb-3 font-semibold">{fullLabel}</legend>
          {field.item.choices.map((choice) => (
            <Checkbox
              key={choice}
              label={fieldLabel(choice, language)}
              checked={items.includes(choice)}
              onChange={(e) =>
                onChange(e.target.checked ? [...items, choice] : items.filter((x) => x !== choice))
              }
            />
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
        </fieldset>
      );
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-semibold" htmlFor={id}>
          {fullLabel}
        </label>
        <textarea
          id={id}
          name={path}
          rows={4}
          className="w-full resize-none rounded-lg border border-line bg-surface p-3 text-sm"
          value={items.join('\n')}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {error || text('One value per line.', 'Une valeur par ligne.', language)}
        </p>
      </div>
    );
  }
  if (field.type === 'boolean')
    return (
      <Checkbox
        name={path}
        label={fullLabel}
        checked={value === true}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  if (field.choices)
    return (
      <div className="space-y-1.5">
        <SelectField
          name={path}
          label={fullLabel}
          value={String(value ?? '')}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: text('Choose…', 'Choisir…', language) },
            ...field.choices.map((choice) => ({
              value: choice,
              label: fieldLabel(choice, language),
            })),
          ]}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  if (field.name === 'search')
    return (
      <SearchInput
        label={label}
        placeholder={label}
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
      />
    );
  if (LOOKUPS[field.name])
    return (
      <RecordPicker
        context={context}
        name={field.name}
        label={fullLabel}
        value={String(value ?? '')}
        onChange={onChange}
        optional={field.optional}
        error={error}
      />
    );
  const secret = /secret|password|token/i.test(field.name);
  return (
    <TextField
      name={path}
      label={fullLabel}
      value={field.type === 'date' ? localDate(value) : String(value ?? '')}
      error={error}
      type={
        secret
          ? 'password'
          : field.type === 'date'
            ? 'datetime-local'
            : field.type === 'number'
              ? 'number'
              : field.format === 'email'
                ? 'email'
                : field.format === 'url'
                  ? 'url'
                  : 'text'
      }
      min={field.min}
      max={field.max}
      maxLength={field.maxLength}
      step={field.integer ? 1 : field.type === 'number' ? 'any' : undefined}
      autoComplete={secret ? 'new-password' : 'off'}
      required={!field.optional}
      hint={
        field.type === 'date'
          ? text(
              'Your device timezone; saved as an exact instant.',
              'Fuseau horaire de votre appareil ; enregistré comme un instant précis.',
              language,
            )
          : undefined
      }
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Free-form provider/GeoJSON configuration is explicitly structured data upstream. */
function StructuredField({
  label,
  value,
  onChange,
  name,
  error,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  name: string;
  error?: string;
}) {
  const { language } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2),
  );
  const [parseError, setParseError] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={6}
        spellCheck={false}
        value={draft}
        className="w-full resize-none rounded-lg border border-line bg-surface p-3 font-mono text-sm"
        aria-invalid={parseError || !!error}
        aria-describedby={`${id}-hint`}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!e.target.value.trim()) {
            onChange(undefined);
            setParseError(false);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(e.target.value);
            if (!isRecord(parsed)) throw new Error();
            onChange(parsed);
            setParseError(false);
          } catch {
            setParseError(true);
            onChange(e.target.value);
          }
        }}
      />
      <p
        id={`${id}-hint`}
        className={parseError || error ? 'text-sm text-danger' : 'text-xs text-ink-muted'}
      >
        {error ||
          (parseError
            ? text(
                'Enter a valid JSON object, for example {"key": "value"}.',
                'Saisissez un objet JSON valide, par exemple {"clé": "valeur"}.',
                language,
              )
            : text(
                'Advanced structured settings (JSON object).',
                'Paramètres structurés avancés (objet JSON).',
                language,
              ))}
      </p>
    </div>
  );
}
