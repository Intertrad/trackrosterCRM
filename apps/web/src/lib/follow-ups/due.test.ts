import { describe, expect, it } from 'vitest';

import type { ProspectFollowUp } from '@/lib/api/follow-up-types';
import { classifyFollowUp, compareByDue, endOfLocalDay, isAppointment } from './due';

/* Deterministic: nothing here reads the wall clock. */
const now = new Date('2026-09-28T14:00:00.000Z');

function followUp(over: Partial<ProspectFollowUp> = {}): ProspectFollowUp {
  return {
    id: 'f-1',
    campaignId: 'c-1',
    prospectId: 'cp-1',
    establishmentId: 'e-1',
    dueAt: '2026-09-28T16:00:00.000Z',
    status: 'pending',
    category: 'follow_up',
    channel: 'call',
    ownership: 'user',
    completedAt: null,
    cancelledAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

describe('follow-up due state', () => {
  /*
   * §36. The same follow-up must classify the same way wherever it is read. These
   * are the four cases both Ma journée and the follow-up list depend on.
   */
  it('classifies yesterday, later today and tomorrow', () => {
    const dayEnd = new Date('2026-09-28T23:59:59.999Z');

    expect(classifyFollowUp(followUp({ dueAt: '2026-09-27T09:00:00.000Z' }), now, dayEnd)).toBe(
      'overdue',
    );

    expect(classifyFollowUp(followUp({ dueAt: '2026-09-28T16:00:00.000Z' }), now, dayEnd)).toBe(
      'today',
    );

    expect(classifyFollowUp(followUp({ dueAt: '2026-09-29T09:00:00.000Z' }), now, dayEnd)).toBe(
      'upcoming',
    );
  });

  /*
   * Overdue is an instant comparison, not a calendar one — which is what the API
   * does: prospector-today computes dueAt < generatedAt, and the follow-up query
   * uses status = 'pending' AND due_at < now(). A follow-up due at 09:00 is late at
   * 09:01 the same morning; it does not wait for midnight.
   */
  it('treats a time earlier today as overdue, not as due today', () => {
    const dayEnd = new Date('2026-09-28T23:59:59.999Z');

    expect(classifyFollowUp(followUp({ dueAt: '2026-09-28T09:00:00.000Z' }), now, dayEnd)).toBe(
      'overdue',
    );
  });

  it('agrees with the API rule for overdue across a spread of times', () => {
    const dayEnd = new Date('2026-09-28T23:59:59.999Z');

    for (const dueAt of [
      '2026-09-01T00:00:00.000Z',
      '2026-09-28T13:59:59.000Z',
      '2026-09-28T14:00:01.000Z',
      '2026-10-05T00:00:00.000Z',
    ]) {
      const item = followUp({ dueAt });

      /* The server's predicate, restated: pending AND due_at < now(). */
      const serverSaysOverdue =
        item.status === 'pending' && new Date(dueAt).getTime() < now.getTime();

      expect(classifyFollowUp(item, now, dayEnd) === 'overdue', dueAt).toBe(serverSaysOverdue);
    }
  });

  it('takes a settled follow-up out of every active group', () => {
    const dayEnd = new Date('2026-09-28T23:59:59.999Z');

    /* Completed late is done, not overdue: the list is about what is left. */
    expect(
      classifyFollowUp(
        followUp({ status: 'completed', dueAt: '2026-09-01T00:00:00.000Z' }),
        now,
        dayEnd,
      ),
    ).toBe('completed');

    expect(
      classifyFollowUp(
        followUp({ status: 'cancelled', dueAt: '2026-09-01T00:00:00.000Z' }),
        now,
        dayEnd,
      ),
    ).toBe('cancelled');
  });

  /*
   * §37. The today/upcoming boundary is the only calendar question, and it is cut in
   * the reader's own zone. A UTC midnight would put a 23:30 local follow-up on the
   * wrong day for most of Europe.
   */
  it('cuts the day in the reader local zone, not at UTC midnight', () => {
    /* 21:30 UTC on the 28th is 23:30 on the 28th in Paris. */
    const parisNow = new Date('2026-09-28T20:00:00.000Z');
    const parisDayEnd = new Date('2026-09-28T21:59:59.999Z');
    const late = followUp({ dueAt: '2026-09-28T21:30:00.000Z' });

    expect(classifyFollowUp(late, parisNow, parisDayEnd)).toBe('today');

    /* 22:30 UTC is 00:30 on the 29th in Paris, so it is tomorrow's work. */
    expect(
      classifyFollowUp(followUp({ dueAt: '2026-09-28T22:30:00.000Z' }), parisNow, parisDayEnd),
    ).toBe('upcoming');
  });

  it('ends the local day at the last millisecond of it', () => {
    const end = endOfLocalDay(new Date('2026-09-28T09:00:00.000Z'));

    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  /* An unreadable timestamp surfaces rather than sorting itself into the future. */
  it('treats an unparseable due time as needing attention now', () => {
    expect(classifyFollowUp(followUp({ dueAt: 'not-a-date' }), now)).toBe('overdue');
  });

  /*
   * §13/§17. An appointment is a category, so it cuts across the due states rather
   * than replacing them — an overdue appointment must still appear as overdue.
   */
  it('keeps appointment orthogonal to the due state', () => {
    const dayEnd = new Date('2026-09-28T23:59:59.999Z');
    const lateMeeting = followUp({ category: 'meeting', dueAt: '2026-09-27T09:00:00.000Z' });

    expect(isAppointment(lateMeeting)).toBe(true);
    expect(classifyFollowUp(lateMeeting, now, dayEnd)).toBe('overdue');

    expect(isAppointment(followUp({ category: 'follow_up' }))).toBe(false);
    expect(isAppointment(followUp({ category: 'todo' }))).toBe(false);
  });

  it('orders every group by due time', () => {
    const early = followUp({ dueAt: '2026-09-28T09:00:00.000Z' });
    const late = followUp({ dueAt: '2026-09-28T17:00:00.000Z' });

    /* Oldest first for overdue, soonest first for the rest — one comparator. */
    expect([late, early].sort(compareByDue)[0]).toBe(early);
  });
});
