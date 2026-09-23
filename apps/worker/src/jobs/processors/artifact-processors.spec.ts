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
    const r = await new ScheduledReportProcessor(
      { query } as never,
      { get: vi.fn().mockReturnValue(undefined), getOrThrow: vi.fn() } as never,
    ).process({
      jobId: 'j',
      tenantId: 't',
      requestedAt: new Date().toISOString(),
      scheduleId: 's',
      deliveryId: 'd',
    });
    expect(r.status).toBe('processed');
  });
  it('noops for missing compliance exports', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const r = await new ComplianceArtifactProcessor(
      { query } as never,
      { get: vi.fn(), getOrThrow: vi.fn() } as never,
    ).process({ jobId: 'j', tenantId: 't', requestedAt: new Date().toISOString(), exportId: 'e' });
    expect(r).toEqual({ status: 'noop', reason: 'export missing' });
  });
});
