import { describe, expect, it } from 'vitest';
import {
  DOMAIN_EVENT_TYPES,
  domainEventTypeFromAuditAction,
  isDomainEventType,
} from './domain-events.js';

describe('domain event contract', () => {
  it('contains the complete lifecycle and coordination vocabulary', () => {
    expect(DOMAIN_EVENT_TYPES).toEqual([
      'prospect.assigned',
      'reservation.claimed',
      'reservation.rejected',
      'action.logged',
      'followup.due',
      'override.requested',
      'override.decided',
      'import.completed',
    ]);
  });

  it('accepts canonical audit actions and rejects unrelated audit actions', () => {
    expect(domainEventTypeFromAuditAction('override.requested')).toBe('override.requested');
    expect(domainEventTypeFromAuditAction('organization.updated')).toBeNull();
    expect(isDomainEventType('import.completed')).toBe(true);
    expect(isDomainEventType('import.failed')).toBe(false);
  });
});
