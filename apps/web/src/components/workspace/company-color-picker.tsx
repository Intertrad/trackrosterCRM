'use client';
import { useId } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

const colors = [
  ['#05124a', 'Navy', 'Bleu marine'],
  ['#0f59fa', 'Blue', 'Bleu'],
  ['#0e9f6e', 'Green', 'Vert'],
  ['#7c3aed', 'Purple', 'Violet'],
  ['#e8790a', 'Orange', 'Orange'],
  ['#b3262c', 'Red', 'Rouge'],
  ['#be185d', 'Pink', 'Rose'],
  ['#0e7490', 'Cyan', 'Cyan'],
  ['#0f766e', 'Teal', 'Turquoise'],
  ['#4f46e5', 'Indigo', 'Indigo'],
  ['#854d0e', 'Ochre', 'Ocre'],
  ['#475569', 'Slate', 'Ardoise'],
] as const;

export function CompanyColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { language } = useTranslation();
  const name = useId();
  const options = colors.map(([color, en, fr]) => ({ color, label: text(en, fr, language) }));
  if (!colors.some(([color]) => color === value.toLowerCase())) {
    options.push({
      color: value as (typeof colors)[number][0],
      label: text('Current color', 'Couleur actuelle', language),
    });
  }
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">
        {text('Company color', 'Couleur de l’entreprise', language)}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ color, label }) => (
          <label
            key={color}
            title={label}
            className="relative flex size-11 cursor-pointer items-center justify-center rounded-full"
          >
            <input
              type="radio"
              className="peer sr-only"
              name={name}
              value={color}
              aria-label={label}
              checked={value.toLowerCase() === color.toLowerCase()}
              onChange={() => onChange(color)}
            />
            <span
              aria-hidden="true"
              className="size-8 rounded-full ring-brand ring-offset-2 ring-offset-surface peer-checked:ring-[3px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand"
              style={{ backgroundColor: color }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
