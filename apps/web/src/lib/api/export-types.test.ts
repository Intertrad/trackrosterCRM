import { describe, expect, it } from 'vitest';

import {
  canCancel,
  canDownload,
  describeFailure,
  isExportRunning,
  type ExportJob,
  type ExportStatus,
} from './export-types';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

function job(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: 'e1',
    tenantId: 't',
    requesterId: 'm',
    status: 'completed',
    request: { type: 'activities' },
    filename: 'activities.csv',
    contentType: 'text/csv',
    rowCount: 12,
    failureCode: null,
    attempts: 1,
    downloadExpiresAt: null,
    expiresAt: '2026-09-25T12:00:00.000Z',
    createdAt: '2026-09-24T11:00:00.000Z',
    updatedAt: '2026-09-24T11:01:00.000Z',
    ...overrides,
  };
}

describe('isExportRunning', () => {
  it('is true only while the job is still moving', () => {
    expect(isExportRunning(job({ status: 'queued' }))).toBe(true);
    expect(isExportRunning(job({ status: 'processing' }))).toBe(true);
  });

  /* The list polls on this; a settled job must stop the polling. */
  it('is false for every settled state', () => {
    const settled: ExportStatus[] = ['completed', 'failed', 'cancelled', 'expired'];

    for (const status of settled) {
      expect(isExportRunning(job({ status }))).toBe(false);
    }
  });
});

describe('canDownload', () => {
  it('allows a completed job inside its retention window', () => {
    expect(canDownload(job(), NOW)).toBe(true);
  });

  it('refuses a job that has not completed', () => {
    expect(canDownload(job({ status: 'processing' }), NOW)).toBe(false);
    expect(canDownload(job({ status: 'failed' }), NOW)).toBe(false);
  });

  /*
   * The window can lapse between the list being read and the button being
   * pressed, so status alone is not enough.
   */
  it('refuses a completed job whose retention has lapsed', () => {
    expect(canDownload(job({ expiresAt: '2026-09-24T11:00:00.000Z' }), NOW)).toBe(false);
  });

  it('allows a completed job with no published expiry', () => {
    expect(canDownload(job({ expiresAt: null }), NOW)).toBe(true);
  });

  it('does not treat an unparseable expiry as lapsed', () => {
    expect(canDownload(job({ expiresAt: 'soon' }), NOW)).toBe(true);
  });
});

describe('canCancel', () => {
  it('allows cancelling only a running job', () => {
    expect(canCancel(job({ status: 'queued' }))).toBe(true);
    expect(canCancel(job({ status: 'completed' }))).toBe(false);
  });
});

describe('describeFailure', () => {
  /* The control working is not a generic error; say what actually happened. */
  it('explains an authority change in the operator’s terms', () => {
    expect(describeFailure(job({ status: 'failed', failureCode: 'authority_changed' }))).toContain(
      'access changed',
    );
  });

  it('falls back to the raw code rather than saying nothing useful', () => {
    expect(describeFailure(job({ status: 'failed', failureCode: 'disk_full' }))).toContain(
      'disk full',
    );
  });

  it('still says something when no code was recorded', () => {
    expect(describeFailure(job({ status: 'failed', failureCode: null }))).toBe(
      'This export did not complete.',
    );
  });
});
