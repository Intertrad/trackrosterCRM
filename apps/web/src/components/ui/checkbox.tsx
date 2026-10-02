'use client';

import { type InputHTMLAttributes, useId } from 'react';

import { cn } from '@/lib/ui/cn';

export function Checkbox({
  label,
  hideLabel = false,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: string;
  hideLabel?: boolean;
}) {
  const id = useId();

  return (
    <div className={cn('flex items-center', !hideLabel && 'gap-2.5')}>
      <input
        id={id}
        type="checkbox"
        className={cn(
          'size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px]',
          'border border-line bg-surface',
          'checked:border-brand checked:bg-brand',
          'checked:bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2016%2016%27%20fill%3D%27none%27%20stroke%3D%27white%27%20stroke-width%3D%272.5%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27M3%208.5l3.2%203.2L13%205%27%2F%3E%3C%2Fsvg%3E")] checked:bg-center checked:bg-no-repeat',
          'transition-colors duration-150',
          'disabled:cursor-not-allowed disabled:opacity-55',
          className,
        )}
        {...rest}
      />

      <label
        htmlFor={id}
        className={hideLabel ? 'sr-only' : 'cursor-pointer text-[14px] text-ink-soft select-none'}
      >
        {label}
      </label>
    </div>
  );
}
