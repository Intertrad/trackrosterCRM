import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<StatTone, string> = {
  brand: 'bg-brand-tint text-brand',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger text-white',
  neutral: 'bg-surface-muted text-ink-muted',
};

/*
 * The headline figure used across manager and director screens. A value of
 * null renders as an em dash so an unavailable metric never reads as zero.
 */
export function StatTile({
  icon,
  tone = 'brand',
  value,
  label,
  delta,
  className,
}: {
  icon: ReactNode;
  tone?: StatTone;
  value: number | string | null;
  label: string;
  delta?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-full',
          TONES[tone],
        )}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-[30px] leading-none font-bold text-navy tabular-nums">
          {value ?? '—'}
        </span>

        <span className="mt-1 block truncate text-[14px] text-ink-muted">{label}</span>

        {delta ? (
          <span className="mt-1 block text-[13px] font-semibold text-success">{delta}</span>
        ) : null}
      </span>
    </div>
  );
}
