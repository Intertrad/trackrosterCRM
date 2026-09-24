'use client';

import { type ClipboardEvent, type KeyboardEvent, useEffect, useRef } from 'react';

import { cn } from '@/lib/ui/cn';

/*
 * Six single-character boxes that behave as one field: paste fills the whole
 * code, Backspace walks backwards, and arrow keys move between boxes. The
 * value is owned by the parent so submission stays a single controlled read.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  label: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const completedRef = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === length && completedRef.current !== value) {
      completedRef.current = value;
      onComplete?.(value);

      return;
    }

    if (value.length < length) {
      completedRef.current = null;
    }
  }, [length, onComplete, value]);

  function setDigit(index: number, digit: string): void {
    const next = value.padEnd(length, ' ').split('');
    next[index] = digit || ' ';

    onChange(next.join('').replace(/ +$/, '').replace(/ /g, ''));
  }

  function handleChange(index: number, raw: string): void {
    const digits = raw.replace(/\D/g, '');

    if (!digits) {
      setDigit(index, '');

      return;
    }

    /* A paste or fast type into one box spills into the following boxes. */
    const merged = (value.slice(0, index) + digits).slice(0, length);
    onChange(merged);

    const focusTarget = Math.min(merged.length, length - 1);
    refs.current[focusTarget]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault();
      onChange(value.slice(0, index - 1));
      refs.current[index - 1]?.focus();

      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();

      return;
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    event.preventDefault();

    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    if (!digits) {
      return;
    }

    onChange(digits);
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  }

  return (
    <div role="group" aria-label={label} className="flex items-center gap-2.5 sm:gap-3">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${length}`}
          maxLength={1}
          className={cn(
            'h-[62px] w-full min-w-0 rounded-xl border bg-surface text-center',
            'text-[26px] font-semibold text-navy tabular-nums',
            'transition-colors duration-150',
            'disabled:cursor-not-allowed disabled:bg-surface-muted',
            invalid ? 'border-danger' : 'border-line hover:border-brand-pale',
          )}
        />
      ))}
    </div>
  );
}
