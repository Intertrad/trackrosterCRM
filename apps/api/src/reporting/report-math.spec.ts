import { describe, expect, it } from 'vitest';

import { buildFunnelStages, completeness, rate } from './report-math.js';
import { LIFECYCLE_STAGES } from './report-query.constants.js';

describe('rate', () => {
  /*
   * The distinction this protects: a team that has contacted nobody has an
   * unknown conversion rate, not a zero one. Reporting the second as the
   * first tells a manager their team is failing when nothing was measured.
   */
  it('is null when nothing has been measured', () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
  });

  it('is zero when there were opportunities and none converted', () => {
    expect(rate(0, 10)).toBe(0);
  });

  it('reports one decimal place', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(2, 3)).toBe(66.7);
  });

  it('reports a full rate as 100', () => {
    expect(rate(7, 7)).toBe(100);
  });
});

describe('buildFunnelStages', () => {
  it('emits every stage in pipeline order', () => {
    const { stages } = buildFunnelStages(new Map());

    expect(stages.map((stage) => stage.stage)).toEqual([...LIFECYCLE_STAGES]);
  });

  /* An omitted empty stage reads as though the stage does not exist. */
  it('keeps a stage nobody has reached, at zero', () => {
    const { stages, total } = buildFunnelStages(new Map([['to_contact', 4]]));

    expect(total).toBe(4);
    expect(stages.find((stage) => stage.stage === 'converted')).toEqual({
      stage: 'converted',
      total: 0,
      share: 0,
    });
  });

  it('computes each stage share against the funnel total', () => {
    const { total, stages } = buildFunnelStages(
      new Map([
        ['to_contact', 3],
        ['converted', 1],
      ]),
    );

    expect(total).toBe(4);
    expect(stages.find((stage) => stage.stage === 'to_contact')?.share).toBe(75);
    expect(stages.find((stage) => stage.stage === 'converted')?.share).toBe(25);
  });

  it('does not divide by zero on an empty funnel', () => {
    const { total, stages } = buildFunnelStages(new Map());

    expect(total).toBe(0);
    expect(stages.every((stage) => stage.share === 0)).toBe(true);
  });

  /* A stage the API does not know about must not inflate the total. */
  it('ignores a stage outside the catalogue', () => {
    expect(buildFunnelStages(new Map([['invented_stage', 99]])).total).toBe(0);
  });
});

describe('completeness', () => {
  it('is null when there is nothing to assess', () => {
    expect(completeness(0, { phone: 0 })).toBeNull();
  });

  /*
   * One record missing four fields is one incomplete record, not four. The
   * worst single field bounds how many records can possibly be complete.
   */
  it('counts records, not field occurrences', () => {
    expect(completeness(10, { phone: 3, website: 3, address: 3 })).toBe(70);
  });

  it('is 100 when nothing is missing', () => {
    expect(completeness(10, { phone: 0, website: 0 })).toBe(100);
  });

  it('is 0 when every record is missing something', () => {
    expect(completeness(10, { phone: 10 })).toBe(0);
  });

  it('never goes negative if a count exceeds the total', () => {
    expect(completeness(5, { phone: 9 })).toBe(0);
  });
});
