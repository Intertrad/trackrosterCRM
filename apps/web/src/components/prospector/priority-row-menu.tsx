'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, History, MoreHorizontal, UserRound } from 'lucide-react';

import type { MessageKey } from '@/lib/i18n/dictionary';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

interface MenuLink {
  href: string;
  label: MessageKey;
  icon: typeof UserRound;
}

/**
 * Secondary destinations for one row of the day.
 *
 * Every entry is a route that exists — the row's primary button already
 * covers the main job, and a menu of disabled or invented items would be
 * worse than no menu.
 */
export function PriorityRowMenu({ prospectHref, label }: { prospectHref: string; label: string }) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const links: MenuLink[] = [
    { href: prospectHref, label: 'today.viewProspect', icon: UserRound },
    { href: `${prospectHref}?tab=timeline`, label: 'today.activityHistory', icon: History },
    { href: '/follow-ups', label: 'today.allFollowUps', icon: CalendarClock },
  ];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('today.moreFor', { name: label })}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg text-ink-muted',
          'transition-colors duration-150 hover:bg-surface-muted hover:text-ink',
        )}
      >
        <MoreHorizontal aria-hidden="true" className="size-5" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl',
            'border border-line-soft bg-surface shadow-lg',
          )}
        >
          {links.map((link) => (
            <Link
              key={link.label}
              role="menuitem"
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-ink',
                'transition-colors duration-150 hover:bg-surface-muted',
              )}
            >
              <link.icon aria-hidden="true" className="size-[18px] text-ink-muted" />
              {t(link.label)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
