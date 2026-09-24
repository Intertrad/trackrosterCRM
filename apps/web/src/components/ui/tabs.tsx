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
    <nav aria-label={label} className="border-b border-line-soft">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = item.id === activeId;

          return (
            <li key={item.id} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 px-4 py-3 text-[15px] font-semibold',
                  'transition-colors duration-150',
                  active
                    ? 'border-brand text-brand'
                    : 'border-transparent text-ink-muted hover:text-ink',
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
