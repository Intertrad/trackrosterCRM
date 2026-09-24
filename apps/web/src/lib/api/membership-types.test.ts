import { describe, expect, it } from 'vitest';

import { membershipInitials, membershipName } from './membership-types';

describe('membershipName', () => {
  it('prefers the display name', () => {
    expect(membershipName({ displayName: 'Sophie Chevalier', email: 's@x.ca' })).toBe(
      'Sophie Chevalier',
    );
  });

  /* An invited membership has no display name until it is accepted, and a
   * whitespace-only name must not render as a blank row. */
  it('falls back to the email when the display name is missing or blank', () => {
    expect(membershipName({ displayName: null, email: 's@x.ca' })).toBe('s@x.ca');
    expect(membershipName({ displayName: '   ', email: 's@x.ca' })).toBe('s@x.ca');
  });
});

describe('membershipInitials', () => {
  it('uses the first letter of the first two words', () => {
    expect(membershipInitials({ displayName: 'Sophie Chevalier', email: 's@x.ca' })).toBe('SC');
  });

  it('derives initials from an email when there is no name', () => {
    expect(membershipInitials({ displayName: null, email: 's.chevalier@intertrad.ca' })).toBe('SC');
  });

  it('returns a single initial rather than nothing for a one-word name', () => {
    expect(membershipInitials({ displayName: 'Sophie', email: 's@x.ca' })).toBe('S');
  });
});
