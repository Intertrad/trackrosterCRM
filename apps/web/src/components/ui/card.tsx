import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export function Card({
  children,
  className,
  padding = 'default',
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  padding?: 'default' | 'none';
}) {
  return (
    <section
      style={style}
      className={cn(
        'min-w-0 rounded-[14px] border border-line bg-surface shadow-card',
        padding === 'default' && 'p-[18px]',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex flex-wrap items-start justify-between gap-4', className)}>
      <h2 className="text-base font-extrabold tracking-[-0.015em] text-navy">{title}</h2>

      {action}
    </div>
  );
}

export function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <dt className="shrink-0 text-[14px] text-ink-muted">{label}</dt>

      <dd className="min-w-0 text-right text-[14px] font-semibold text-ink">{children}</dd>
    </div>
  );
}
