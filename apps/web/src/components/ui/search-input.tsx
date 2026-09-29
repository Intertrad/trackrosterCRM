'use client';

import { type InputHTMLAttributes, useId, useRef } from 'react';
import { Search, X } from 'lucide-react';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

export function SearchInput({
  label,
  className,
  onClear,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: string;
  onClear?: () => void;
}) {
  const id = useId();
  const { language } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

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
        ref={inputRef}
        type="search"
        className={cn(
          'h-10 w-full rounded-[9px] border border-line bg-surface pr-4 pl-11 text-[14.4px] text-ink',
          'placeholder:text-ink-muted',
          onClear ? 'pr-12' : '',
          'transition-colors duration-150 hover:border-brand-pale',
        )}
        {...rest}
      />
      {onClear && rest.value && (
        <button
          type="button"
          aria-label={`${language === 'fr' ? 'Effacer' : 'Clear'} ${label}`}
          className="absolute inset-y-0 right-2 flex w-9 items-center justify-center text-ink-muted"
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
        >
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </div>
  );
}
