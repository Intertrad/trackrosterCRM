'use client';

import Link from 'next/link';

import { cn } from '@/lib/ui/cn';

export interface TabItem {
  id: string;
  label: string;
  href: string;
}

/*
 * Tabs are links, not buttons: a tab is a distinct view of the account and
 * must be shareable, reloadable and reachable by the browser's back button.
 */
export function Tabs({
  items,
  activeId,
  label,
}: {
  items: TabItem[];
  activeId: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="max-w-full">
      <ul className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[11px] bg-surface-muted p-[3px]">
        {items.map((item) => {
          const active = item.id === activeId;

          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block rounded-[9px] px-3.5 py-[7px] text-[14.08px] font-bold',
                  'transition-colors duration-150',
                  active
                    ? 'bg-surface text-navy shadow-sm'
                    : 'text-ink-muted hover:bg-surface/60 hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
