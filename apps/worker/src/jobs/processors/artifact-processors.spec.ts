import { describe, expect, it, vi } from 'vitest';
import { ScheduledReportProcessor } from './scheduled-report.processor.js';
import { ComplianceArtifactProcessor } from './compliance-artifact.processor.js';
describe('artifact processors', () => {
  it('marks an active scheduled report delivered', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ report_key: 'overview', recipients: [], format: 'json', active: 1 }],
      })
      .mockResolvedValueOnce({ rows: [{ active_members: 2 }] })
      .mockResolvedValue({ rows: [] });
    const client = {
      query: vi.fn().mockImplementation((...args: unknown[]) => {
        const statement = String(args[0]);
        return /^(BEGIN|COMMIT|ROLLBACK|SELECT set_config)/.test(statement)
          ? Promise.resolve({ rows: [], rowCount: 0 })
          : query(...args);
      }),
      release: vi.fn(),
    };
    const r = await new ScheduledReportProcessor(
      { connect: vi.fn().mockResolvedValue(client) } as never,
      { get: vi.fn().mockReturnValue(undefined), getOrThrow: vi.fn() } as never,
    ).process({
      jobId: 'j',
      tenantId: '11111111-1111-4111-8111-111111111111',
      requestedAt: new Date().toISOString(),
      scheduleId: 's',
      deliveryId: 'd',
    });
    expect(r.status).toBe('processed');
  });
  it('noops for missing compliance exports', async () => {
    const r = await new ComplianceArtifactProcessor(
      {
        connect: vi
          .fn()
          .mockResolvedValue({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() }),
      } as never,
      { get: vi.fn(), getOrThrow: vi.fn() } as never,
    ).process({
      jobId: 'j',
      tenantId: '11111111-1111-4111-8111-111111111111',
      requestedAt: new Date().toISOString(),
      exportId: 'e',
    });
    expect(r).toEqual({ status: 'noop', reason: 'export missing' });
  });
});
