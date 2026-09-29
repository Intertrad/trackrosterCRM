'use client';

import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  trailing?: ReactNode;
  leading?: ReactNode;
  labelSuffix?: ReactNode;
  language?: 'en' | 'fr';
}

export function TextField({
  label,
  error,
  hint,
  trailing,
  leading,
  labelSuffix,
  language: requestedLanguage,
  className,
  type = 'text',
  ...rest
}: TextFieldProps) {
  const { language: activeLanguage } = useTranslation();
  const language = requestedLanguage ?? activeLanguage;
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && revealed ? 'text' : type;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13.12px] font-bold text-ink">
          {label}
        </label>

        {labelSuffix}
      </div>

      <div className="relative">
        {leading && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center"
          >
            <span className="rounded-lg bg-surface-muted p-2 text-ink-muted">{leading}</span>
          </span>
        )}
        <input
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            'h-10 w-full rounded-[9px] border bg-surface px-3.5 text-[14.4px] text-ink',
            'placeholder:text-ink-muted',
            'transition-colors duration-150',
            'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted',
            error
              ? 'border-danger focus-visible:outline-danger/30'
              : 'border-line hover:border-brand-pale',
            Boolean(isPassword || trailing || error) && 'pr-12',
            Boolean(leading) && 'pl-14',
            className,
          )}
          {...rest}
        />

        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2">
          {error ? <CircleAlert className="size-5 text-danger" aria-hidden="true" /> : null}

          {isPassword && !error ? (
            <button
              type="button"
              onClick={() => setRevealed((current) => !current)}
              aria-label={
                language === 'fr'
                  ? revealed
                    ? 'Masquer le mot de passe'
                    : 'Afficher le mot de passe'
                  : revealed
                    ? 'Hide password'
                    : 'Show password'
              }
              className="pointer-events-auto text-ink-muted transition-colors hover:text-ink"
            >
              {revealed ? (
                <EyeOff className="size-5" aria-hidden="true" />
              ) : (
                <Eye className="size-5" aria-hidden="true" />
              )}
            </button>
          ) : null}

          {trailing ? <div className="pointer-events-auto">{trailing}</div> : null}
        </div>
      </div>

      {error ? (
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {hint ? (
        <div id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
