import { describe, expect, it } from 'vitest';

import {
  formatPace,
  objectiveStatusTone,
  rankObjectives,
  type ObjectiveRisk,
  type ObjectiveStatus,
} from './director-types';

function objective(id: string, status: ObjectiveStatus, pace: number | null = 0.5): ObjectiveRisk {
  return {
    id,
    name: `Objective ${id}`,
    metric: 'activities',
    target: 100,
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-10-01T00:00:00.000Z',
    ownerId: 'm1',
    progress: {
      actual: 40,
      target: 100,
      remaining: 60,
      progressPercent: 40,
      elapsedPercent: 70,
      expectedToDate: 70,
      pace,
      status,
    },
  };
}

/*
 * A risk list that includes things which are fine stops being read. Only
 * objectives actually behind appear, worst first.
 */
describe('rankObjectives', () => {
  it('drops objectives that are not a concern', () => {
    const ranked = rankObjectives([
      objective('a', 'achieved'),
      objective('b', 'on_track'),
      objective('c', 'not_started', null),
    ]);

    expect(ranked).toEqual([]);
  });

  it('keeps missed, at-risk and watch', () => {
    const ranked = rankObjectives([
      objective('watch', 'watch'),
      objective('missed', 'missed'),
      objective('risk', 'at_risk'),
    ]);

    expect(ranked.map((o) => o.id)).toEqual(['missed', 'risk', 'watch']);
  });

  /* Within one status, the furthest behind schedule is the more urgent. */
  it('orders equally-classified objectives by how far behind pace they are', () => {
    const ranked = rankObjectives([
      objective('closer', 'at_risk', 0.7),
      objective('further', 'at_risk', 0.2),
    ]);

    expect(ranked.map((o) => o.id)).toEqual(['further', 'closer']);
  });

  it('returns an empty list when nothing is tracked', () => {
    expect(rankObjectives([])).toEqual([]);
  });
});

describe('objectiveStatusTone', () => {
  it('treats missed and at-risk as equally alarming', () => {
    expect(objectiveStatusTone('missed')).toBe('danger');
    expect(objectiveStatusTone('at_risk')).toBe('danger');
  });

  it('separates watch from both fine and failing', () => {
    expect(objectiveStatusTone('watch')).toBe('warning');
    expect(objectiveStatusTone('on_track')).toBe('brand');
    expect(objectiveStatusTone('achieved')).toBe('success');
  });
});

describe('formatPace', () => {
  /* Null pace means the window has not opened — not zero progress. */
  it('says not started rather than reporting 0%', () => {
    expect(formatPace(null)).toBe('Not started');
  });

  it('reports pace as a percentage of schedule', () => {
    expect(formatPace(0.5)).toBe('50% of pace');
    expect(formatPace(1.2)).toBe('120% of pace');
  });
});
