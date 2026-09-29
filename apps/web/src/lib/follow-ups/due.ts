import type { ProspectFollowUp } from '@/lib/api/follow-up-types';

/**
 * When a follow-up is due, decided once.
 *
 * Ma journée and the follow-up list both answer this question, and they were
 * answering it in three separate places — the API's `isOverdue` flag on the day's
 * priorities, and two independent comparisons inside the follow-up page. All three
 * happened to agree, which is exactly the situation in which one of them quietly
 * stops agreeing. This is the single definition both pages now use.
 *
 * It matches the API deliberately, and the API is the reason it is written this way:
 *
 *   - `prospector-today` computes `isOverdue` as `dueAt < generatedAt`;
 *   - the follow-up query treats `overdue` as `status = 'pending' AND due_at < now()`.
 *
 * So **overdue is an instant comparison, not a calendar one**. A follow-up due at
 * 09:00 is overdue at 09:01 on the same day; it does not become overdue at midnight.
 * Getting that backwards is how a list tells a prospector something is late when the
 * server does not think so.
 *
 * Only the boundary between *today* and *upcoming* is a calendar question, and that
 * one is answered in the reader's own time zone — the same IANA zone the browser
 * reports and the API is given for the day's bounds, so both sides cut the day at
 * the same instant. A UTC midnight would put a 23:30 follow-up on the wrong day for
 * most of Europe.
 */
export type FollowUpDueState = 'overdue' | 'today' | 'upcoming' | 'completed' | 'cancelled';

/** The end of the reader's local day, as an instant. */
export function endOfLocalDay(now: Date = new Date()): Date {
  const end = new Date(now);

  end.setHours(23, 59, 59, 999);

  return end;
}

export function classifyFollowUp(
  followUp: Pick<ProspectFollowUp, 'dueAt' | 'status'>,
  now: Date = new Date(),
  dayEnd: Date = endOfLocalDay(now),
): FollowUpDueState {
  /*
   * A settled follow-up has no due state. Checked first so a completed one that was
   * late is never reported as overdue — it is done, and the list is about what is
   * left to do.
   */
  if (followUp.status === 'completed') {
    return 'completed';
  }

  if (followUp.status === 'cancelled') {
    return 'cancelled';
  }

  const due = new Date(followUp.dueAt).getTime();

  /*
   * An unparseable timestamp is treated as due now rather than silently sorted into
   * the future, where it would never be looked at again.
   */
  if (Number.isNaN(due)) {
    return 'overdue';
  }

  if (due < now.getTime()) {
    return 'overdue';
  }

  return due <= dayEnd.getTime() ? 'today' : 'upcoming';
}

/** A follow-up still to be done, whatever day it falls on. */
export function isActive(followUp: Pick<ProspectFollowUp, 'status'>): boolean {
  return followUp.status === 'pending';
}

/*
 * An appointment is a category, not a due state.
 *
 * `meeting` is one of the three categories the domain defines alongside `todo` and
 * `follow_up`, so it cuts across overdue, today and upcoming rather than replacing
 * them: an appointment can be any of those. Treating it as a fourth mutually
 * exclusive bucket would hide an overdue appointment from the overdue list, which is
 * the one place it most needs to appear.
 */
export function isAppointment(followUp: Pick<ProspectFollowUp, 'category'>): boolean {
  return followUp.category === 'meeting';
}

/**
 * Ordering within a group: ascending by due time.
 *
 * That is the same comparison for every group, and deliberately so — for overdue it
 * reads oldest first, because the longest-waiting prospect is the most urgent, and
 * for today and upcoming it reads soonest first, which is the order the day happens
 * in. One comparator rather than a branch that returns the same thing twice.
 */
export function compareByDue(
  left: Pick<ProspectFollowUp, 'dueAt'>,
  right: Pick<ProspectFollowUp, 'dueAt'>,
): number {
  return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
}
