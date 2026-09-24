'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

import type { SelectOption } from '@/components/ui/select-field';
import { cn } from '@/lib/ui/cn';

/*
 * The pill-shaped "Status: Qualified" control from the handoff. It keeps the
 * label visible once a value is chosen so a filtered list never looks like a
 * short list — the design spec's filtered-empty requirement depends on it.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[14px] font-semibold text-ink-muted"
      >
        {label}:
      </span>

      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-11 w-full appearance-none rounded-full border border-line bg-surface',
          'pr-10 text-[14px] font-semibold text-ink',
          'transition-colors duration-150 hover:border-brand-pale',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        style={{ paddingLeft: `${label.length * 0.52 + 1.6}rem` }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span className="sr-only">{selected?.label}</span>

      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
