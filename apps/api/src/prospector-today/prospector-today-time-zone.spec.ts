import { describe, expect, it } from 'vitest';

import { resolveProspectorTodayDay } from './prospector-today-time-zone.js';

describe('resolveProspectorTodayDay', () => {
  it('resolves a 23-hour Paris day across the spring DST transition', () => {
    const day = resolveProspectorTodayDay(new Date('2026-03-29T12:00:00.000Z'), 'Europe/Paris');

    expect(day.date).toBe('2026-03-29');
    expect(day.startsAt.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(day.endsAt.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('resolves a 25-hour Paris day across the autumn DST transition', () => {
    const day = resolveProspectorTodayDay(new Date('2026-10-25T12:00:00.000Z'), 'Europe/Paris');

    expect(day.date).toBe('2026-10-25');
    expect(day.startsAt.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(day.endsAt.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it('resolves Cairo when the spring transition skips local midnight', () => {
    const day = resolveProspectorTodayDay(new Date('2026-04-24T12:00:00.000Z'), 'Africa/Cairo');

    expect(day.date).toBe('2026-04-24');
    expect(day.startsAt.toISOString()).toBe('2026-04-23T22:00:00.000Z');
    expect(day.endsAt.toISOString()).toBe('2026-04-24T21:00:00.000Z');
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('resolves Havana when the spring transition skips local midnight', () => {
    const day = resolveProspectorTodayDay(new Date('2026-03-08T12:00:00.000Z'), 'America/Havana');

    expect(day.date).toBe('2026-03-08');
    expect(day.startsAt.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(day.endsAt.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(day.endsAt.getTime() - day.startsAt.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});
