import { describe, expect, it } from 'vitest';

import {
  commitBlockers,
  importSteps,
  type ImportJob,
  type ImportRow,
  type ImportStatus,
} from './import-types';

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: 'job-1',
    tenantId: 'tenant-1',
    requesterId: 'member-1',
    status: 'draft',
    filename: null,
    fileHash: null,
    headers: [],
    mapping: {},
    summary: {},
    rowCount: 0,
    createdAt: '2026-09-23T10:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
    etag: 'W/"1"',
    ...overrides,
  };
}

function row(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    id: `row-${overrides.rowNumber ?? 1}`,
    tenantId: 'tenant-1',
    importId: 'job-1',
    rowNumber: overrides.rowNumber ?? 1,
    data: {
      rowNumber: overrides.rowNumber ?? 1,
      status: 'valid',
      establishment: null,
      contact: null,
      issues: [],
    },
    resolution: null,
    existingId: null,
    establishmentId: null,
    contactId: null,
    result: null,
    ...overrides,
  };
}

describe('importSteps', () => {
  it('marks nothing complete before a file is uploaded', () => {
    expect(importSteps(null).map((step) => step.state)).toEqual([
      'active',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('treats a file without required mappings as still on the map step', () => {
    const steps = importSteps(
      job({ status: 'uploaded', fileHash: 'abc', mapping: { name: 'Name' } }),
    );

    expect(steps[0]?.state).toBe('complete');
    expect(steps[1]?.state).toBe('active');
  });

  it('completes mapping only once name and country_code are both mapped', () => {
    const steps = importSteps(
      job({
        status: 'uploaded',
        fileHash: 'abc',
        mapping: { name: 'Name', country_code: 'Country' },
      }),
    );

    expect(steps[1]?.state).toBe('complete');
    expect(steps[2]?.state).toBe('active');
  });

  it('marks normalize and deduplicate complete once the file is validated', () => {
    const steps = importSteps(
      job({
        status: 'validated',
        fileHash: 'abc',
        mapping: { name: 'Name', country_code: 'Country' },
      }),
    );

    expect(steps.map((step) => step.state)).toEqual([
      'complete',
      'complete',
      'complete',
      'complete',
      'active',
    ]);
  });

  it('completes every step once committed', () => {
    const steps = importSteps(
      job({
        status: 'committed',
        fileHash: 'abc',
        mapping: { name: 'Name', country_code: 'Country' },
      }),
    );

    expect(steps.every((step) => step.state === 'complete')).toBe(true);
  });

  /*
   * Correcting a row rewinds the job to `uploaded` and discards the parsed
   * rows. The stepper has to walk backwards with it, otherwise the operator is
   * told validation is done when the API has thrown it away.
   */
  it('walks back to normalize when a correction rewinds the job', () => {
    const rewound: ImportStatus = 'uploaded';

    const steps = importSteps(
      job({
        status: rewound,
        fileHash: 'abc',
        mapping: { name: 'Name', country_code: 'Country' },
      }),
    );

    expect(steps[2]?.state).toBe('active');
    expect(steps[3]?.state).toBe('pending');
  });
});

describe('commitBlockers', () => {
  it('reports nothing when every row is clean', () => {
    expect(commitBlockers([row({ rowNumber: 1 }), row({ rowNumber: 2 })])).toEqual([]);
  });

  it('blocks on an invalid row', () => {
    const invalid = row({ rowNumber: 1 });

    invalid.data.status = 'invalid';

    expect(commitBlockers([invalid])).toHaveLength(1);
    expect(commitBlockers([invalid])[0]).toContain('errors');
  });

  it('blocks on a row that duplicates another row in the same file', () => {
    const duplicate = row({ rowNumber: 2 });

    duplicate.data.issues = [
      { code: 'duplicate_in_file', severity: 'warning', message: 'duplicate' },
    ];

    expect(commitBlockers([duplicate])[0]).toContain('duplicate another row');
  });

  it('blocks on an existing match that has no decision', () => {
    const matched = row({ rowNumber: 3, existingId: 'establishment-1' });

    expect(commitBlockers([matched])[0]).toContain('match an existing establishment');
  });

  it('clears an existing match once reuse is chosen', () => {
    expect(
      commitBlockers([row({ rowNumber: 3, existingId: 'establishment-1', resolution: 'reuse' })]),
    ).toEqual([]);
  });

  /* A skipped row is excluded from the commit, so none of its problems block. */
  it('ignores every problem on a skipped row', () => {
    const skipped = row({ rowNumber: 4, existingId: 'establishment-1', resolution: 'skip' });

    skipped.data.status = 'invalid';
    skipped.data.issues = [
      { code: 'duplicate_in_file', severity: 'warning', message: 'duplicate' },
    ];

    expect(commitBlockers([skipped])).toEqual([]);
  });

  it('reports each distinct reason separately', () => {
    const invalid = row({ rowNumber: 1 });

    invalid.data.status = 'invalid';

    expect(commitBlockers([invalid, row({ rowNumber: 2, existingId: 'e-1' })])).toHaveLength(2);
  });
});
