import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import { CreateSavedViewDto, UpdateSavedViewDto } from './saved-views.dto.js';
import {
  CreateScheduledReportDto,
  UpdateScheduledReportDto,
} from '../scheduled-reports/scheduled-reports.dto.js';
import {
  AccessReviewDecisionDto,
  CreateComplianceReportDto,
} from '../compliance/compliance.dto.js';
import {
  ApiClientDto,
  ConnectIntegrationDto,
  WebhookDto,
} from '../integrations/integrations.dto.js';
import { EvidenceExportScopeDto } from '../audit/audit.dto.js';

/*
 * These assert the property the fix restores across five modules: that the
 * global ValidationPipe has a class to work against. Before this, each of
 * these bodies was `any` or `Record<string, unknown>`, which carries no
 * runtime metatype — Nest skipped the handler and neither whitelist nor
 * forbidNonWhitelisted applied.
 */
function check<T extends object>(cls: new () => T, payload: unknown) {
  return validateSync(plainToInstance(cls, payload) as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

const VALID_VIEW = {
  resource: 'prospects',
  name: 'My view',
  filters: { stage: 'to_contact' },
  columns: ['name', 'city'],
};

describe('CreateSavedViewDto', () => {
  it('accepts a well-formed view', () => {
    expect(check(CreateSavedViewDto, VALID_VIEW)).toEqual([]);
  });

  it('rejects a resource outside the catalogue', () => {
    expect(check(CreateSavedViewDto, { ...VALID_VIEW, resource: 'invoices' })).not.toEqual([]);
  });

  /* The old handler copied arbitrary keys into the row. */
  it('rejects an unknown property instead of persisting it', () => {
    const errors = check(CreateSavedViewDto, { ...VALID_VIEW, ownerId: 'someone-else' });

    expect(errors.map((error) => error.property)).toContain('ownerId');
  });

  it('rejects filters that are not an object', () => {
    expect(check(CreateSavedViewDto, { ...VALID_VIEW, filters: 'everything' })).not.toEqual([]);
  });

  it('caps the column list', () => {
    const columns = Array.from({ length: 101 }, (_value, index) => `c${index}`);

    expect(check(CreateSavedViewDto, { ...VALID_VIEW, columns })).not.toEqual([]);
  });
});

describe('UpdateSavedViewDto', () => {
  it('accepts a partial update', () => {
    expect(check(UpdateSavedViewDto, { name: 'Renamed' })).toEqual([]);
  });

  it('still refuses an unknown property', () => {
    expect(check(UpdateSavedViewDto, { ownerId: 'x' }).length).toBeGreaterThan(0);
  });
});

const VALID_SCHEDULE = {
  reportKey: 'funnel',
  cadence: 'weekly',
  format: 'csv',
  recipients: ['ops@example.com'],
};

describe('CreateScheduledReportDto', () => {
  it('accepts a well-formed schedule', () => {
    expect(check(CreateScheduledReportDto, VALID_SCHEDULE)).toEqual([]);
  });

  it('rejects an unknown report key', () => {
    expect(check(CreateScheduledReportDto, { ...VALID_SCHEDULE, reportKey: 'profit' })).not.toEqual(
      [],
    );
  });

  /* A schedule mails its output, so the recipient list is the blast radius. */
  it('rejects a recipient that is not an email address', () => {
    expect(
      check(CreateScheduledReportDto, { ...VALID_SCHEDULE, recipients: ['not-an-email'] }),
    ).not.toEqual([]);
  });

  it('rejects an empty recipient list', () => {
    expect(check(CreateScheduledReportDto, { ...VALID_SCHEDULE, recipients: [] })).not.toEqual([]);
  });

  it('caps the recipient list', () => {
    const recipients = Array.from({ length: 51 }, (_v, i) => `user${i}@example.com`);

    expect(check(CreateScheduledReportDto, { ...VALID_SCHEDULE, recipients })).not.toEqual([]);
  });

  it('rejects a nextRunAt with no offset', () => {
    expect(
      check(CreateScheduledReportDto, { ...VALID_SCHEDULE, nextRunAt: '2026-10-01T09:00:00' }),
    ).not.toEqual([]);
  });
});

describe('UpdateScheduledReportDto', () => {
  it('rejects an unknown cadence', () => {
    expect(check(UpdateScheduledReportDto, { cadence: 'hourly' })).not.toEqual([]);
  });
});

describe('AccessReviewDecisionDto', () => {
  const membershipId = '8f14e45f-ceea-4e6a-9f3a-1c2d3e4f5a6b';

  it('accepts a decision', () => {
    expect(check(AccessReviewDecisionDto, { membershipId, decision: 'revoke' })).toEqual([]);
  });

  it('rejects a decision outside the catalogue', () => {
    expect(check(AccessReviewDecisionDto, { membershipId, decision: 'ignore' })).not.toEqual([]);
  });

  it('rejects a membership id that is not a UUID', () => {
    expect(check(AccessReviewDecisionDto, { membershipId: 'me', decision: 'approve' })).not.toEqual(
      [],
    );
  });
});

describe('CreateComplianceReportDto', () => {
  it('rejects a report type longer than the column', () => {
    expect(check(CreateComplianceReportDto, { reportType: 'x'.repeat(61) })).not.toEqual([]);
  });

  it('rejects parameters that are not an object', () => {
    expect(
      check(CreateComplianceReportDto, { reportType: 'access', parameters: 'all' }),
    ).not.toEqual([]);
  });
});

describe('ApiClientDto', () => {
  /* A scope list is an authorization grant, not free text. */
  it('rejects a malformed scope', () => {
    expect(check(ApiClientDto, { name: 'CI', scopes: ['Not A Scope'] })).not.toEqual([]);
  });

  it('accepts conventional scopes', () => {
    expect(check(ApiClientDto, { name: 'CI', scopes: ['prospects.read'] })).toEqual([]);
  });
});

describe('WebhookDto', () => {
  /* http would send deliveries in clear text. */
  it('refuses a non-https endpoint', () => {
    expect(check(WebhookDto, { url: 'http://example.com/hook', events: ['a.b'] })).not.toEqual([]);
  });

  it('accepts an https endpoint', () => {
    expect(check(WebhookDto, { url: 'https://example.com/hook', events: ['a.b'] })).toEqual([]);
  });
});

describe('ConnectIntegrationDto', () => {
  it('accepts provider settings nested under config', () => {
    expect(check(ConnectIntegrationDto, { config: { region: 'eu' } })).toEqual([]);
  });

  /* Loose top-level keys were what the untyped body used to swallow. */
  it('rejects loose top-level keys', () => {
    expect(check(ConnectIntegrationDto, { apiKey: 'secret' }).length).toBeGreaterThan(0);
  });
});

describe('EvidenceExportScopeDto', () => {
  it('accepts a bounded scope', () => {
    expect(
      check(EvidenceExportScopeDto, {
        resourceTypes: ['assignment'],
        from: '2026-09-01T00:00:00.000Z',
      }),
    ).toEqual([]);
  });

  it('rejects an unknown resource type', () => {
    expect(check(EvidenceExportScopeDto, { resourceTypes: ['everything'] })).not.toEqual([]);
  });

  /* This is what the unbounded blob allowed before. */
  it('rejects arbitrary keys', () => {
    expect(check(EvidenceExportScopeDto, { anything: 'x'.repeat(10_000) }).length).toBeGreaterThan(
      0,
    );
  });
});
