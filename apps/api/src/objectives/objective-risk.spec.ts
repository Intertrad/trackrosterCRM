import { describe, it, expect } from 'vitest';
import { objectiveRisk } from './objective-risk.js';
describe('Objective risk thresholds', () => {
  const start = new Date('2026-01-01T00:00:00Z'),
    end = new Date('2026-01-11T00:00:00Z'),
    mid = new Date('2026-01-06T00:00:00Z');
  it('classifies exact pace boundaries', () => {
    expect(objectiveRisk(100, 39, start, end, mid).status).toBe('at_risk');
    expect(objectiveRisk(100, 40, start, end, mid).status).toBe('watch');
    expect(objectiveRisk(100, 50, start, end, mid).status).toBe('on_track');
  });
  it('handles future, missed and overachieved periods without division by zero', () => {
    expect(objectiveRisk(100, 0, start, end, start).projectedAtEnd).toBeNull();
    expect(objectiveRisk(100, 0, start, end, new Date('2025-12-01')).status).toBe('not_started');
    expect(objectiveRisk(100, 99, start, end, end).status).toBe('missed');
    expect(objectiveRisk(100, 110, start, end, end).status).toBe('achieved');
  });
});
