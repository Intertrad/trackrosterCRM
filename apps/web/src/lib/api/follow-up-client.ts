import { browserJson } from './browser-json';

import type {
  CancelProspectFollowUpInput,
  CompleteProspectFollowUpInput,
  CreateProspectFollowUpInput,
  FollowUpQueueResponse,
  ListFollowUpQueueOptions,
  ListProspectFollowUpsInput,
  ProspectFollowUp,
  ProspectFollowUpListResponse,
  RescheduleProspectFollowUpInput,
} from './follow-up-types';

function buildProspectFollowUpPath(campaignId: string, prospectId: string): string {
  return (
    `/api/work-queue/${encodeURIComponent(campaignId)}` +
    `/${encodeURIComponent(prospectId)}` +
    '/follow-ups'
  );
}

function buildFollowUpActionPath(
  campaignId: string,
  prospectId: string,
  followUpId: string,
  action: 'reschedule' | 'complete' | 'cancel',
): string {
  return (
    buildProspectFollowUpPath(campaignId, prospectId) +
    `/${encodeURIComponent(followUpId)}` +
    `/${action}`
  );
}

function buildTeamQuery(teamId: string): string {
  const query = new URLSearchParams();

  query.set('teamId', teamId);

  return query.toString();
}

export async function listFollowUpQueue(
  input: ListFollowUpQueueOptions,
): Promise<FollowUpQueueResponse> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  if (input.overdue !== undefined) {
    query.set('overdue', String(input.overdue));
  }

  if (input.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  return browserJson<FollowUpQueueResponse>(`/api/follow-ups?${query.toString()}`, {
    method: 'GET',

    cache: 'no-store',

    signal: input.signal,
  });
}

export async function listProspectFollowUps(
  input: ListProspectFollowUpsInput,
): Promise<ProspectFollowUpListResponse> {
  const query = buildTeamQuery(input.teamId);

  return browserJson<ProspectFollowUpListResponse>(
    buildProspectFollowUpPath(input.campaignId, input.prospectId) + `?${query}`,
    {
      method: 'GET',

      cache: 'no-store',
    },
  );
}

export async function createProspectFollowUp(
  input: CreateProspectFollowUpInput,
): Promise<ProspectFollowUp> {
  const query = buildTeamQuery(input.teamId);

  const body =
    input.ownership === undefined
      ? {
          dueAt: input.dueAt,
        }
      : {
          dueAt: input.dueAt,

          ownership: input.ownership,
        };

  return browserJson<ProspectFollowUp>(
    buildProspectFollowUpPath(input.campaignId, input.prospectId) + `?${query}`,
    {
      method: 'POST',

      headers: {
        'content-type': 'application/json',

        'idempotency-key': input.idempotencyKey,
      },

      body: JSON.stringify(body),
    },
  );
}

export async function rescheduleProspectFollowUp(
  input: RescheduleProspectFollowUpInput,
): Promise<ProspectFollowUp> {
  const query = buildTeamQuery(input.teamId);

  return browserJson<ProspectFollowUp>(
    buildFollowUpActionPath(input.campaignId, input.prospectId, input.followUpId, 'reschedule') +
      `?${query}`,
    {
      method: 'PATCH',

      headers: {
        'content-type': 'application/json',

        'idempotency-key': input.idempotencyKey,
      },

      body: JSON.stringify({
        dueAt: input.dueAt,
      }),
    },
  );
}

export async function completeProspectFollowUp(
  input: CompleteProspectFollowUpInput,
): Promise<ProspectFollowUp> {
  const query = buildTeamQuery(input.teamId);

  return browserJson<ProspectFollowUp>(
    buildFollowUpActionPath(input.campaignId, input.prospectId, input.followUpId, 'complete') +
      `?${query}`,
    {
      method: 'POST',

      headers: {
        'idempotency-key': input.idempotencyKey,
      },
    },
  );
}

export async function cancelProspectFollowUp(
  input: CancelProspectFollowUpInput,
): Promise<ProspectFollowUp> {
  const query = buildTeamQuery(input.teamId);

  return browserJson<ProspectFollowUp>(
    buildFollowUpActionPath(input.campaignId, input.prospectId, input.followUpId, 'cancel') +
      `?${query}`,
    {
      method: 'POST',

      headers: {
        'idempotency-key': input.idempotencyKey,
      },
    },
  );
}
