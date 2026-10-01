import { describe, expect, it } from 'vitest';

import {
  isChannelEnabled,
  isChannelRequired,
  setChannel,
  type NotificationPreferences,
} from './notification-preference-types';

describe('isChannelEnabled', () => {
  it('requires collision alerts in the in-app inbox', () => {
    expect(isChannelRequired('collisions', 'inApp')).toBe(true);
    expect(isChannelEnabled({ collisions: { inApp: false } }, 'collisions', 'inApp')).toBe(true);
  });
  /*
   * The backend treats a missing entry as "not opted out". Rendering an unset
   * channel as off would tell the user they had declined notifications they
   * never declined.
   */
  it('treats a channel that has never been set as on', () => {
    expect(isChannelEnabled({}, 'assignments', 'email')).toBe(true);
  });

  it('treats a category with other channels set as still on for the unset one', () => {
    expect(isChannelEnabled({ assignments: { push: false } }, 'assignments', 'email')).toBe(true);
  });

  it('respects an explicit opt-out', () => {
    expect(isChannelEnabled({ assignments: { email: false } }, 'assignments', 'email')).toBe(false);
  });

  it('respects an explicit opt-in', () => {
    expect(isChannelEnabled({ messages: { push: true } }, 'messages', 'push')).toBe(true);
  });
});

describe('setChannel', () => {
  it('does not allow the required collision inbox channel to be disabled', () => {
    const before: NotificationPreferences = { collisions: { inApp: true } };

    expect(setChannel(before, 'collisions', 'inApp', false)).toBe(before);
  });
  it('sets one channel without disturbing the others in that category', () => {
    const before: NotificationPreferences = {
      assignments: { email: true, push: false, inApp: true },
    };

    const after = setChannel(before, 'assignments', 'push', true);

    expect(after.assignments).toEqual({ email: true, push: true, inApp: true });
  });

  it('leaves other categories untouched', () => {
    const before: NotificationPreferences = { messages: { email: false } };

    const after = setChannel(before, 'imports', 'email', false);

    expect(after.messages).toEqual({ email: false });
    expect(after.imports).toEqual({ email: false });
  });

  it('does not mutate the input', () => {
    const before: NotificationPreferences = { collisions: { email: true } };

    setChannel(before, 'collisions', 'email', false);

    expect(before.collisions).toEqual({ email: true });
  });

  it('creates the category when it does not exist yet', () => {
    expect(setChannel({}, 'overrides', 'inApp', false).overrides).toEqual({ inApp: false });
  });
});
