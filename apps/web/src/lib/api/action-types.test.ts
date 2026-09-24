import { describe, expect, it } from 'vitest';

import {
  actionEventLabel,
  canCancelAction,
  canCorrectAction,
  toLifecycleStatus,
} from './action-types';

/*
 * The UI and the API name the running state differently — `in_progress`
 * versus `started`. Sending a display value as a filter is rejected upstream,
 * so the mapping is pinned here.
 */
describe('toLifecycleStatus', () => {
  it('maps the display name for a running action to the API name', () => {
    expect(toLifecycleStatus('in_progress')).toBe('started');
  });

  it('passes through the states both vocabularies share', () => {
    expect(toLifecycleStatus('planned')).toBe('planned');
    expect(toLifecycleStatus('completed')).toBe('completed');
    expect(toLifecycleStatus('cancelled')).toBe('cancelled');
  });

  /* due and overdue are computed from a date, not stored, so they cannot be
   * sent as a status filter at all. */
  it('refuses to map the date-derived display states', () => {
    expect(toLifecycleStatus('due')).toBeNull();
    expect(toLifecycleStatus('overdue')).toBeNull();
  });
});

describe('canCancelAction', () => {
  it('allows cancelling an action that has not finished', () => {
    expect(canCancelAction('planned')).toBe(true);
    expect(canCancelAction('in_progress')).toBe(true);
  });

  it('refuses to cancel an action the API considers closed', () => {
    expect(canCancelAction('completed')).toBe(false);
    expect(canCancelAction('cancelled')).toBe(false);
  });
});

describe('canCorrectAction', () => {
  /* A correction is only accepted once there is an outcome to correct. */
  it('allows a correction only on a completed action', () => {
    expect(canCorrectAction('completed')).toBe(true);
    expect(canCorrectAction('planned')).toBe(false);
    expect(canCorrectAction('in_progress')).toBe(false);
    expect(canCorrectAction('cancelled')).toBe(false);
  });
});

describe('actionEventLabel', () => {
  it('renders a stored event type as a sentence', () => {
    expect(actionEventLabel('outcome_corrected')).toBe('Outcome corrected');
    expect(actionEventLabel('action.started')).toBe('Action started');
  });
});
