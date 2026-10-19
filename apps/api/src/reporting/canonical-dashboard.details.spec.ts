import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { CanonicalDashboardService } from './canonical-dashboard.controller.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
const actor = { tenantId: 'tenant', membershipId: 'member' } as AuthenticatedPrincipal;
function setup() {
  const execute = vi.fn().mockResolvedValue({ rows: [] });
  const getDashboard = vi.fn().mockResolvedValue({
    generatedAt: '2026-10-15T12:00:00Z',
    range: { from: '2026-10-01T00:00:00Z', to: '2026-10-16T00:00:00Z' },
    scope: { authority: 'manager', organizationId: 'org', teamId: 'team' },
    filters: {},
  });
  type Args = ConstructorParameters<typeof CanonicalDashboardService>;
  const service = new CanonicalDashboardService(
    { execute } as unknown as Args[0],
    { getDashboard } as unknown as Args[1],
    {} as Args[2],
    {} as Args[3],
    {} as Args[4],
  );
  return { execute, getDashboard, service };
}
describe('dashboard detail authorization and counts', () => {
  it('scopes activity to the resolved tenant, organization, team and selected dates', async () => {
    const { execute, service } = setup();
    await service.activityDetails(actor, {});
    const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]);
    expect(query.params).toEqual(
      expect.arrayContaining([
        'tenant',
        'org',
        'team',
        '2026-10-01T00:00:00Z',
        '2026-10-16T00:00:00Z',
      ]),
    );
    expect(query.sql).toContain("ac.status='completed'");
    expect(query.sql).toContain("ac.status='cancelled'");
    expect(query.sql).toContain('ac.due_at <');
  });
  it('does not run detail queries after a scope denial', async () => {
    const { execute, getDashboard, service } = setup();
    getDashboard.mockRejectedValue(new ForbiddenException());
    await expect(service.activityDetails(actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(execute).not.toHaveBeenCalled();
  });
  it('denies user lists to accounts without tenant admin authority', async () => {
    const { execute, service } = setup();
    await expect(service.peopleDetails(actor, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('returns bounded pending duplicate rows with tenant filtering', async () => {
    const { execute, service } = setup();
    execute.mockResolvedValueOnce({ rows: [{ allowed: 1 }] }).mockResolvedValueOnce({
      rows: [{ id: 'pair', leftName: 'Alpha', rightName: 'Alpha SARL' }],
    });
    expect((await service.duplicateDetails(actor, {})).items).toHaveLength(1);
    const query = new PgDialect().sqlToQuery(execute.mock.calls[1]![0]);
    expect(query.params).toContain('tenant');
    expect(query.sql).toContain("d.resolution='pending'");
    expect(query.sql).toContain('LIMIT 101');
  });
});
