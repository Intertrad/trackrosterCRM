import { describe, expect, it } from 'vitest';

import { auditActionLabel, auditResourceLabel, auditSeverity } from './audit-types';

describe('auditSeverity', () => {
  it('treats access and role changes as warnings', () => {
    expect(auditSeverity('role.permissions_updated')).toBe('warning');
    expect(auditSeverity('membership.permissions_updated')).toBe('warning');
    expect(auditSeverity('access_grant.created')).toBe('warning');
    expect(auditSeverity('collision_override.approved')).toBe('warning');
  });

  it('treats routine activity as informational', () => {
    expect(auditSeverity('assignment.assigned')).toBe('info');
    expect(auditSeverity('campaign.created')).toBe('info');
    expect(auditSeverity('import.committed')).toBe('info');
    expect(auditSeverity('session.created')).toBe('info');
  });

  it('treats failures and cancellations as errors', () => {
    expect(auditSeverity('auth.failed')).toBe('error');
    expect(auditSeverity('import.cancelled')).toBe('error');
  });

  /* session.revoked is a warning; session.created must not be dragged along
   * with it by a loose prefix match. */
  it('does not let the session.revoked rule catch session.created', () => {
    expect(auditSeverity('session.revoked')).toBe('warning');
    expect(auditSeverity('session.created')).toBe('info');
  });
});

describe('label helpers', () => {
  it('renders an action verb as a sentence', () => {
    expect(auditActionLabel('collision_override.approved')).toBe('Collision override approved');
  });

  it('renders a resource type as a sentence', () => {
    expect(auditResourceLabel('tenant_membership')).toBe('Tenant membership');
  });
});
