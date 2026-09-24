import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-xl border border-line-soft bg-surface p-5 shadow-card sm:p-6',
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
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">{title}</h2>

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
