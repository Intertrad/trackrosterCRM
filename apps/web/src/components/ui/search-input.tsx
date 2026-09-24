'use client';

import { type InputHTMLAttributes, useId } from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

export function SearchInput({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & { label: string }) {
  const id = useId();

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-muted"
      />

      <input
        id={id}
        type="search"
        className={cn(
          'h-12 w-full rounded-lg border border-line bg-surface pr-4 pl-11 text-[15px] text-ink',
          'placeholder:text-ink-muted',
          'transition-colors duration-150 hover:border-brand-pale',
        )}
        {...rest}
      />
    </div>
  );
}
