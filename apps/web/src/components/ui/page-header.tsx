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
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-[1_1_320px]">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-navy sm:text-[35.2px]">
          {title}
        </h1>

        {subtitle ? <p className="mt-1.5 text-[15.2px] text-ink-muted">{subtitle}</p> : null}
      </div>

      {action}
    </header>
  );
}
