'use client';

import { type SelectHTMLAttributes, useId } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  options,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  options: SelectOption[];
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold text-ink">
        {label}
      </label>

      <div className="relative">
        <select
          id={id}
          className={cn(
            'h-12 w-full appearance-none rounded-lg border border-line bg-surface',
            'px-3.5 pr-11 text-[15px] text-ink',
            'transition-colors duration-150 hover:border-brand-pale',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted',
            className,
          )}
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-5 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  );
}
