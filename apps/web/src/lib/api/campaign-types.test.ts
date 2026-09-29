import { describe, expect, it } from 'vitest';

import {
  allowedTransitions,
  campaignStatusLabel,
  campaignStatusTone,
  memberRoleLabel,
  type CampaignStatus,
} from './campaign-types';

/*
 * The API validates which status moves are legal. Offering an illegal one
 * produces a guaranteed rejection, so the UI only renders what will be
 * accepted — these pin that contract.
 */
describe('allowedTransitions', () => {
  it('lets a draft go live or be abandoned', () => {
    expect(allowedTransitions('draft')).toEqual(['active', 'archived']);
  });

  it('lets an active campaign pause, complete or archive', () => {
    expect(allowedTransitions('active')).toEqual(['paused', 'completed', 'archived']);
  });

  it('lets a paused campaign resume', () => {
    expect(allowedTransitions('paused')).toContain('active');
  });

  /* A completed campaign is not reopened; it is filed away. */
  it('only lets a completed campaign be archived', () => {
    expect(allowedTransitions('completed')).toEqual(['archived']);
  });

  it('treats archived as terminal', () => {
    expect(allowedTransitions('archived')).toEqual([]);
  });

  it('never offers a transition back to the status already held', () => {
    const statuses: CampaignStatus[] = ['draft', 'active', 'paused', 'completed', 'archived'];

    for (const status of statuses) {
      expect(allowedTransitions(status)).not.toContain(status);
    }
  });
});

describe('campaignStatusTone', () => {
  it('distinguishes running from stalled', () => {
    expect(campaignStatusTone('active')).toBe('success');
    expect(campaignStatusTone('paused')).toBe('warning');
  });

  it('treats closed states as neutral', () => {
    expect(campaignStatusTone('completed')).toBe('neutral');
    expect(campaignStatusTone('archived')).toBe('neutral');
  });
});

describe('labels', () => {
  it('renders every status', () => {
    expect(campaignStatusLabel('draft')).toBe('Draft');
    expect(campaignStatusLabel('archived')).toBe('Archived');
  });

  it('renders every campaign role', () => {
    expect(memberRoleLabel('coordinator')).toBe('Coordinator');
    expect(memberRoleLabel('observer')).toBe('Observer');
    expect(memberRoleLabel('member')).toBe('Member');
  });
});
