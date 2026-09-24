import type { MessageKey } from '@/lib/i18n/dictionary';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

export type DueState = 'overdue' | 'due_soon' | 'due_today' | 'upcoming';

const STATES: Record<DueState, { label: MessageKey; dot: string; text: string }> = {
  overdue: { label: 'due.overdue', dot: 'bg-danger', text: 'text-danger' },
  /* Amber reads as "next up", so the one action about to come due is
   * distinguishable from the rest of the day at a glance. */
  due_soon: { label: 'due.today', dot: 'bg-warning', text: 'text-ink-soft' },
  due_today: { label: 'due.today', dot: 'bg-success', text: 'text-ink-soft' },
  upcoming: { label: 'due.upcoming', dot: 'bg-brand-mid', text: 'text-ink-soft' },
};

/** How close an action has to be before it is called out as imminent. */
export const DUE_SOON_MINUTES = 60;

export function DueStateBadge({ state }: { state: DueState }) {
  const { t } = useTranslation();

  const config = STATES[state];

  return (
    <span className={cn('inline-flex items-center gap-2 text-[14px] font-medium', config.text)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', config.dot)} />
      {t(config.label)}
    </span>
  );
}

/**
 * Warn only about work that is genuinely late relative to the API's own day.
 *
 * `now` is injected rather than read from the clock so the caller decides how
 * often the screen re-evaluates, and so this stays testable.
 */
export function resolveDueState(
  dueAt: string,
  isOverdue: boolean,
  dayEndsAt: string,
  now: number = Date.now(),
): DueState {
  if (isOverdue) {
    return 'overdue';
  }

  const due = new Date(dueAt).getTime();

  if (Number.isNaN(due)) {
    return 'upcoming';
  }

  if (due > new Date(dayEndsAt).getTime()) {
    return 'upcoming';
  }

  /* Imminent means "about to happen", so a time that has already passed
   * without the API calling it overdue is not it. */
  const untilDue = due - now;

  return untilDue >= 0 && untilDue <= DUE_SOON_MINUTES * 60_000 ? 'due_soon' : 'due_today';
}

/** `due_soon` is a shade of `due_today`, not a separate bucket to filter by. */
export function countsAsDueToday(state: DueState): boolean {
  return state === 'due_today' || state === 'due_soon';
}
