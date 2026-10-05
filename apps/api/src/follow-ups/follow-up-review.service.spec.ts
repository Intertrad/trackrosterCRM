import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import type { Database } from '../database/database.types.js';
import type { FollowUpReminderSchedulerService } from './follow-up-reminder-scheduler.service.js';
import type { ProspectFollowUpService } from './prospect-follow-up.service.js';
import { FollowUpReviewService } from './follow-up-review.service.js';

describe('FollowUpReviewService', () => {
  const auth = {
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    membershipId: '33333333-3333-4333-8333-333333333333',
  } as AuthenticatedPrincipal;
  const followUp = {
    id: '44444444-4444-4444-8444-444444444444',
    tenantId: auth.tenantId,
    campaignId: '55555555-5555-4555-8555-555555555555',
    campaignProspectId: '66666666-6666-4666-8666-666666666666',
    assignmentId: '77777777-7777-4777-8777-777777777777',
    dueAt: new Date('2020-01-01T09:30:00.000Z'),
  };
  const summaryRow = {
    id: '88888888-8888-4888-8888-888888888888',
    followUpId: followUp.id,
    campaignId: followUp.campaignId,
    prospectId: followUp.campaignProspectId,
    establishmentName: 'Épinal city hall',
    campaignName: 'GFTIJ',
    requestedBy: auth.membershipId,
    reason: 'The prospect moved the meeting and the call was missed.',
    previousDueAt: followUp.dueAt.toISOString(),
    requestedDueAt: '2099-03-04T14:30:00.000Z',
    createdAt: '2026-10-05T10:00:00.000Z',
    assignmentId: followUp.assignmentId,
  };
  let database: { execute: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let followUps: { getMutablePending: ReturnType<typeof vi.fn> };
  let scheduler: { schedule: ReturnType<typeof vi.fn> };
  let service: FollowUpReviewService;

  beforeEach(() => {
    database = {
      execute: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [summaryRow] }),
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          update: () => ({
            set: () => ({
              where: () => ({
                returning: vi.fn().mockResolvedValue([{ id: followUp.id }]),
              }),
            }),
          }),
        }),
      ),
    };
    audit = { record: vi.fn().mockResolvedValue({ id: summaryRow.id }) };
    followUps = { getMutablePending: vi.fn().mockResolvedValue(followUp) };
    scheduler = { schedule: vi.fn().mockResolvedValue(undefined) };
    service = new FollowUpReviewService(
      database as unknown as Database,
      audit as unknown as AuditService,
      followUps as unknown as ProspectFollowUpService,
      scheduler as unknown as FollowUpReminderSchedulerService,
    );
  });

  it('returns the newly-created request to a prospector while keeping review listings scoped', async () => {
    const result = await service.request(auth, {
      campaignId: followUp.campaignId,
      prospectId: followUp.campaignProspectId,
      followUpId: followUp.id,
      dueAt: new Date(summaryRow.requestedDueAt),
      reason: summaryRow.reason,
    });

    expect(result).toMatchObject({
      id: summaryRow.id,
      establishmentName: summaryRow.establishmentName,
      requestedDueAt: summaryRow.requestedDueAt,
    });
    expect(database.execute).toHaveBeenCalledTimes(2);
  });

  it('lets a manager complete the overdue follow-up as late', async () => {
    database.execute.mockReset().mockResolvedValue({ rows: [summaryRow] });

    const result = await service.decide(
      auth,
      summaryRow.id,
      'completed',
      'The prospect was reached after the original deadline.',
    );

    expect(result).toEqual({
      id: summaryRow.id,
      decision: 'completed',
      followUpId: followUp.id,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'follow_up.completed_late' }),
      expect.anything(),
    );
    expect(scheduler.schedule).not.toHaveBeenCalled();
  });

  it('returns an existing pending request when the prospector retries', async () => {
    database.execute.mockReset().mockResolvedValueOnce({
      rows: [{ id: summaryRow.id }],
    });
    database.execute.mockResolvedValueOnce({ rows: [summaryRow] });

    const result = await service.request(auth, {
      campaignId: followUp.campaignId,
      prospectId: followUp.campaignProspectId,
      followUpId: followUp.id,
      dueAt: new Date(summaryRow.requestedDueAt),
      reason: summaryRow.reason,
    });

    expect(result).toMatchObject({ id: summaryRow.id });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
