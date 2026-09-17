import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  FollowUpQueueResponse,
  ProspectFollowUp,
  ProspectFollowUpListResponse,
} from './follow-up-types';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import {
  cancelProspectFollowUp,
  completeProspectFollowUp,
  createProspectFollowUp,
  listFollowUpQueue,
  listProspectFollowUps,
  rescheduleProspectFollowUp,
} from './follow-up-client';

describe('follow-up-client', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const prospectId = '33333333-3333-4333-8333-333333333333';

  const establishmentId = '44444444-4444-4444-8444-444444444444';

  const followUpId = '55555555-5555-4555-8555-555555555555';

  const dueAt = '2026-09-20T10:00:00.000Z';

  const pendingFollowUp: ProspectFollowUp = {
    id: followUpId,

    campaignId,

    prospectId,

    establishmentId,

    dueAt,

    status: 'pending',

    ownership: 'user',

    completedAt: null,

    cancelledAt: null,

    createdAt: '2026-09-16T10:00:00.000Z',

    updatedAt: '2026-09-16T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFollowUpQueue', () => {
    const queueResponse: FollowUpQueueResponse = {
      items: [
        {
          ...pendingFollowUp,

          campaignName: 'Paris Expansion',

          establishmentName: 'Paris Clinic',
        },
      ],
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(queueResponse);
    });

    it('requests the selected prospector team follow-up queue', async () => {
      await listFollowUpQueue({
        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(`/api/follow-ups?teamId=${teamId}`, {
        method: 'GET',

        cache: 'no-store',
      });
    });

    it('forwards overdue and limit filters', async () => {
      await listFollowUpQueue({
        teamId,

        overdue: true,

        limit: 25,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/follow-ups?teamId=${teamId}` + '&overdue=true' + '&limit=25',
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('preserves overdue false instead of omitting it', async () => {
      await listFollowUpQueue({
        teamId,

        overdue: false,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/follow-ups?teamId=${teamId}` + '&overdue=false',
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed follow-up queue response', async () => {
      await expect(
        listFollowUpQueue({
          teamId,
        }),
      ).resolves.toEqual(queueResponse);
    });

    it('propagates queue transport errors unchanged', async () => {
      const error = new Error('follow-up queue request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        listFollowUpQueue({
          teamId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('listProspectFollowUps', () => {
    const response: ProspectFollowUpListResponse = {
      items: [pendingFollowUp],
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(response);
    });

    it('lists follow-ups through the selected prospector team workspace', async () => {
      await listProspectFollowUps({
        campaignId,

        prospectId,

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/follow-ups` + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('URL-encodes campaign and prospect route segments', async () => {
      await listProspectFollowUps({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue' + '/prospect%20value/follow-ups' + `?teamId=${teamId}`,
        {
          method: 'GET',

          cache: 'no-store',
        },
      );
    });

    it('returns the typed prospect follow-up list', async () => {
      await expect(
        listProspectFollowUps({
          campaignId,

          prospectId,

          teamId,
        }),
      ).resolves.toEqual(response);
    });

    it('propagates prospect follow-up read errors unchanged', async () => {
      const error = new Error('prospect follow-up request failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        listProspectFollowUps({
          campaignId,

          prospectId,

          teamId,
        }),
      ).rejects.toBe(error);
    });
  });

  describe('createProspectFollowUp', () => {
    beforeEach(() => {
      browserJsonMock.mockResolvedValue(pendingFollowUp);
    });

    it('creates a caller-owned follow-up through the selected workspace', async () => {
      const idempotencyKey = 'follow-up-create-001';

      await createProspectFollowUp({
        campaignId,

        prospectId,

        teamId,

        dueAt,

        idempotencyKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/follow-ups` + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',

            'idempotency-key': idempotencyKey,
          },

          body: JSON.stringify({
            dueAt,
          }),
        },
      );
    });

    it('forwards explicit user ownership', async () => {
      await createProspectFollowUp({
        campaignId,

        prospectId,

        teamId,

        dueAt,

        ownership: 'user',

        idempotencyKey: 'follow-up-user-001',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/follow-ups` + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',

            'idempotency-key': 'follow-up-user-001',
          },

          body: JSON.stringify({
            dueAt,

            ownership: 'user',
          }),
        },
      );
    });

    it('forwards team ownership without exposing a user identifier', async () => {
      await createProspectFollowUp({
        campaignId,

        prospectId,

        teamId,

        dueAt,

        ownership: 'team',

        idempotencyKey: 'follow-up-team-001',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}/follow-ups` + `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',

            'idempotency-key': 'follow-up-team-001',
          },

          body: JSON.stringify({
            dueAt,

            ownership: 'team',
          }),
        },
      );
    });

    it('forwards the exact create idempotency key unchanged', async () => {
      const exactKey = 'Case-Sensitive_Create-Key_ABC-123';

      await createProspectFollowUp({
        campaignId,

        prospectId,

        teamId,

        dueAt,

        idempotencyKey: exactKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'content-type': 'application/json',

            'idempotency-key': exactKey,
          },
        }),
      );
    });

    it('URL-encodes create route segments', async () => {
      await createProspectFollowUp({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        teamId,

        dueAt,

        idempotencyKey: 'follow-up-create-encoded',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue' + '/prospect%20value/follow-ups' + `?teamId=${teamId}`,
        expect.any(Object),
      );
    });

    it('returns the typed created follow-up', async () => {
      await expect(
        createProspectFollowUp({
          campaignId,

          prospectId,

          teamId,

          dueAt,

          idempotencyKey: 'follow-up-create-return',
        }),
      ).resolves.toEqual(pendingFollowUp);
    });

    it('propagates create transport errors unchanged', async () => {
      const error = new Error('follow-up creation failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        createProspectFollowUp({
          campaignId,

          prospectId,

          teamId,

          dueAt,

          idempotencyKey: 'follow-up-create-error',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('rescheduleProspectFollowUp', () => {
    const rescheduledDueAt = '2026-09-22T14:00:00.000Z';

    const rescheduledFollowUp: ProspectFollowUp = {
      ...pendingFollowUp,

      dueAt: rescheduledDueAt,

      updatedAt: '2026-09-16T11:00:00.000Z',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(rescheduledFollowUp);
    });

    it('reschedules the exact follow-up through the selected workspace', async () => {
      const idempotencyKey = 'follow-up-reschedule-001';

      await rescheduleProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        dueAt: rescheduledDueAt,

        idempotencyKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}` +
          `/follow-ups/${followUpId}/reschedule` +
          `?teamId=${teamId}`,
        {
          method: 'PATCH',

          headers: {
            'content-type': 'application/json',

            'idempotency-key': idempotencyKey,
          },

          body: JSON.stringify({
            dueAt: rescheduledDueAt,
          }),
        },
      );
    });

    it('forwards the exact reschedule idempotency key unchanged', async () => {
      const exactKey = 'Case-Sensitive_Reschedule-Key';

      await rescheduleProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        dueAt: rescheduledDueAt,

        idempotencyKey: exactKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'content-type': 'application/json',

            'idempotency-key': exactKey,
          },
        }),
      );
    });

    it('URL-encodes every reschedule route segment', async () => {
      await rescheduleProspectFollowUp({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        followUpId: 'follow/up value',

        teamId,

        dueAt: rescheduledDueAt,

        idempotencyKey: 'follow-up-reschedule-encoded',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue' +
          '/prospect%20value' +
          '/follow-ups/follow%2Fup%20value/reschedule' +
          `?teamId=${teamId}`,
        expect.any(Object),
      );
    });

    it('returns the typed rescheduled follow-up', async () => {
      await expect(
        rescheduleProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          dueAt: rescheduledDueAt,

          idempotencyKey: 'follow-up-reschedule-return',
        }),
      ).resolves.toEqual(rescheduledFollowUp);
    });

    it('propagates reschedule transport errors unchanged', async () => {
      const error = new Error('follow-up reschedule failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        rescheduleProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          dueAt: rescheduledDueAt,

          idempotencyKey: 'follow-up-reschedule-error',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('completeProspectFollowUp', () => {
    const completedFollowUp: ProspectFollowUp = {
      ...pendingFollowUp,

      status: 'completed',

      completedAt: '2026-09-16T12:00:00.000Z',

      updatedAt: '2026-09-16T12:00:00.000Z',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(completedFollowUp);
    });

    it('completes the exact follow-up through the selected workspace', async () => {
      const idempotencyKey = 'follow-up-complete-001';

      await completeProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        idempotencyKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}` +
          `/follow-ups/${followUpId}/complete` +
          `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'idempotency-key': idempotencyKey,
          },
        },
      );
    });

    it('forwards the exact complete idempotency key unchanged', async () => {
      const exactKey = 'Case-Sensitive_Complete-Key';

      await completeProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        idempotencyKey: exactKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',

        headers: {
          'idempotency-key': exactKey,
        },
      });
    });

    it('URL-encodes every complete route segment', async () => {
      await completeProspectFollowUp({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        followUpId: 'follow/up value',

        teamId,

        idempotencyKey: 'follow-up-complete-encoded',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue' +
          '/prospect%20value' +
          '/follow-ups/follow%2Fup%20value/complete' +
          `?teamId=${teamId}`,
        expect.any(Object),
      );
    });

    it('returns the typed completed follow-up', async () => {
      await expect(
        completeProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          idempotencyKey: 'follow-up-complete-return',
        }),
      ).resolves.toEqual(completedFollowUp);
    });

    it('propagates complete transport errors unchanged', async () => {
      const error = new Error('follow-up completion failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        completeProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          idempotencyKey: 'follow-up-complete-error',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('cancelProspectFollowUp', () => {
    const cancelledFollowUp: ProspectFollowUp = {
      ...pendingFollowUp,

      ownership: 'team',

      status: 'cancelled',

      cancelledAt: '2026-09-16T12:30:00.000Z',

      updatedAt: '2026-09-16T12:30:00.000Z',
    };

    beforeEach(() => {
      browserJsonMock.mockResolvedValue(cancelledFollowUp);
    });

    it('cancels the exact follow-up through the selected workspace', async () => {
      const idempotencyKey = 'follow-up-cancel-001';

      await cancelProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        idempotencyKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        `/api/work-queue/${campaignId}/${prospectId}` +
          `/follow-ups/${followUpId}/cancel` +
          `?teamId=${teamId}`,
        {
          method: 'POST',

          headers: {
            'idempotency-key': idempotencyKey,
          },
        },
      );
    });

    it('forwards the exact cancel idempotency key unchanged', async () => {
      const exactKey = 'Case-Sensitive_Cancel-Key';

      await cancelProspectFollowUp({
        campaignId,

        prospectId,

        followUpId,

        teamId,

        idempotencyKey: exactKey,
      });

      expect(browserJsonMock).toHaveBeenCalledWith(expect.any(String), {
        method: 'POST',

        headers: {
          'idempotency-key': exactKey,
        },
      });
    });

    it('URL-encodes every cancel route segment', async () => {
      await cancelProspectFollowUp({
        campaignId: 'campaign/value',

        prospectId: 'prospect value',

        followUpId: 'follow/up value',

        teamId,

        idempotencyKey: 'follow-up-cancel-encoded',
      });

      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/work-queue/campaign%2Fvalue' +
          '/prospect%20value' +
          '/follow-ups/follow%2Fup%20value/cancel' +
          `?teamId=${teamId}`,
        expect.any(Object),
      );
    });

    it('returns the typed cancelled follow-up', async () => {
      await expect(
        cancelProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          idempotencyKey: 'follow-up-cancel-return',
        }),
      ).resolves.toEqual(cancelledFollowUp);
    });

    it('propagates cancel transport errors unchanged', async () => {
      const error = new Error('follow-up cancellation failed');

      browserJsonMock.mockRejectedValue(error);

      await expect(
        cancelProspectFollowUp({
          campaignId,

          prospectId,

          followUpId,

          teamId,

          idempotencyKey: 'follow-up-cancel-error',
        }),
      ).rejects.toBe(error);
    });
  });
});
