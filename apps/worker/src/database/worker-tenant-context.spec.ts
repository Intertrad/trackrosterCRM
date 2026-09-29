import { describe, expect, it } from 'vitest';
import { getWorkerTenantContext, setWorkerTenantContext } from './worker-tenant-context.js';

describe('worker tenant context', () => {
  it('stores tenant identity for the active job execution', () => {
    setWorkerTenantContext({
      tenantId: '11111111-1111-4111-8111-111111111111',
      jobId: 'job-1',
      jobName: 'health_check',
    });
    expect(getWorkerTenantContext()).toEqual({
      tenantId: '11111111-1111-4111-8111-111111111111',
      jobId: 'job-1',
      jobName: 'health_check',
    });
  });
});
