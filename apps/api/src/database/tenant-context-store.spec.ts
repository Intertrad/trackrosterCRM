import { describe, expect, it } from 'vitest';
import { getRequestTenantContext, setRequestTenantContext } from './tenant-context-store.js';

describe('request tenant context', () => {
  it('stores the authenticated tenant identity for the current async request', () => {
    expect(getRequestTenantContext()).toBeUndefined();
    setRequestTenantContext({
      tenantId: '11111111-1111-4111-8111-111111111111',
      membershipId: '22222222-2222-4222-8222-222222222222',
      identityId: '33333333-3333-4333-8333-333333333333',
    });
    expect(getRequestTenantContext()?.tenantId).toBe('11111111-1111-4111-8111-111111111111');
  });
});
