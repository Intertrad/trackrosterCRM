import { cn } from '@/lib/ui/cn';

export type DueState = 'overdue' | 'due_today' | 'upcoming';

const STATES: Record<DueState, { label: string; dot: string; text: string }> = {
  overdue: { label: 'Overdue', dot: 'bg-danger', text: 'text-danger' },
  due_today: { label: 'Due today', dot: 'bg-success', text: 'text-ink-soft' },
  upcoming: { label: 'Upcoming', dot: 'bg-brand-mid', text: 'text-ink-soft' },
};

export function DueStateBadge({ state }: { state: DueState }) {
  const config = STATES[state];

  return (
    <span className={cn('inline-flex items-center gap-2 text-[14px] font-medium', config.text)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

/** Warn only about work that is genuinely late relative to the API's own day. */
export function resolveDueState(dueAt: string, isOverdue: boolean, dayEndsAt: string): DueState {
  if (isOverdue) {
    return 'overdue';
  }

  return new Date(dueAt).getTime() <= new Date(dayEndsAt).getTime() ? 'due_today' : 'upcoming';
}
