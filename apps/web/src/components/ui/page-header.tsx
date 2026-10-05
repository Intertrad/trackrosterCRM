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
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 w-full flex-1 sm:w-auto sm:basis-[320px]">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-navy sm:text-[35.2px]">
          {title}
        </h1>

        {subtitle ? <p className="mt-1.5 text-[15.2px] text-ink-muted">{subtitle}</p> : null}
      </div>

      {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:shrink-0">
          {action}
        </div>
      ) : null}
    </header>
  );
}
