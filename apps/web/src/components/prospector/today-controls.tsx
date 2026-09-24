'use client';

import { CalendarDays, RefreshCw, UserRound } from 'lucide-react';

import { cn } from '@/lib/ui/cn';

const PILL = cn(
  'inline-flex h-11 items-center gap-2.5 rounded-xl border border-line-soft bg-surface px-4',
  'text-[15px] font-semibold whitespace-nowrap text-navy',
);

/**
 * The controls beside the Today heading.
 *
 * Both pills are read-outs rather than pickers, because neither has anything
 * to pick:
 *
 * - `GET /prospector/today` takes only `teamId` and `timeZone` and computes
 *   the day server-side, so a date selector would have no request to make.
 * - The queue is always the signed-in prospector's own team work, and
 *   changing which grant is active already has a home in the profile menu,
 *   where the workspaces can be labelled properly.
 *
 * The reload is real: the queue changes while the screen is open.
 */
export function TodayControls({
  dayLabel,
  refreshing,
  onRefresh,
}: {
  dayLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh today"
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center rounded-xl',
          'border border-line-soft bg-surface text-ink-muted',
          'transition-colors duration-150 hover:text-brand disabled:opacity-60',
        )}
      >
        <RefreshCw aria-hidden="true" className={cn('size-[18px]', refreshing && 'animate-spin')} />
      </button>

      <span className={PILL}>
        <CalendarDays aria-hidden="true" className="size-[18px] text-ink-muted" />
        {dayLabel}
      </span>

      <span className={PILL}>
        <UserRound aria-hidden="true" className="size-[18px] text-ink-muted" />
        My prospects
      </span>
    </div>
  );
}
