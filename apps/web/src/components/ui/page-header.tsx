import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-tight font-bold tracking-[-0.025em] text-navy sm:text-[34px]">
          {title}
        </h1>

        {subtitle ? <p className="mt-1 text-[15px] text-ink-soft">{subtitle}</p> : null}
      </div>

      {action}
    </header>
  );
}
