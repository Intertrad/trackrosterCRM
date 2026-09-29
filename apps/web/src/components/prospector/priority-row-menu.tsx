'use client';

import { CalendarClock, History, MoreHorizontal, UserRound } from 'lucide-react';

import { Menu, MenuLink } from '@/components/ui/menu';
import type { MessageKey } from '@/lib/i18n/dictionary';
import { useTranslation } from '@/lib/i18n/i18n-context';

interface MenuLinkSpec {
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

  const links: MenuLinkSpec[] = [
    { href: prospectHref, label: 'today.viewProspect', icon: UserRound },
    { href: `${prospectHref}?tab=timeline`, label: 'today.activityHistory', icon: History },
    { href: '/follow-ups', label: 'today.allFollowUps', icon: CalendarClock },
  ];

  return (
    <Menu
      label={t('today.moreFor', { name: label })}
      trigger={<MoreHorizontal aria-hidden="true" className="size-5" />}
      className="shrink-0"
    >
      {(close) =>
        links.map((link) => (
          <MenuLink
            key={link.label}
            href={link.href}
            onSelect={close}
            icon={<link.icon aria-hidden="true" className="size-[18px] text-ink-muted" />}
          >
            {t(link.label)}
          </MenuLink>
        ))
      }
    </Menu>
  );
}
