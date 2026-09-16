import { browserJson } from './browser-json';

import type {
  AcquiredProspectReservation,
  ProspectActivityType,
  ProspectCollisionDecision,
  ProspectReservationState,
  ProspectTimelinePage,
  RecordedProspectActivity,
  ReleasedProspectReservation,
  WorkQueueProspectDetail,
  WorkQueueResponse,
} from './work-queue-types';

export interface ListWorkQueueInput {
  teamId: string;

  campaignId?: string;

  q?: string;

  cursor?: string;

  limit?: number;
}

export interface RecordProspectActivityInput {
  campaignId: string;

  prospectId: string;

  teamId: string;

  type: ProspectActivityType;

  idempotencyKey: string;
}

export interface GetProspectCollisionDecisionInput {
  campaignId: string;

  prospectId: string;

  teamId: string;
}

export interface GetWorkQueueProspectDetailInput {
  campaignId: string;

  prospectId: string;

  teamId: string;
}

export interface ListProspectTimelineInput {
  campaignId: string;

  prospectId: string;

  teamId: string;

  cursor?: string;

  limit?: number;
}

export interface GetProspectReservationInput {
  campaignId: string;

  prospectId: string;

  teamId: string;
}

export interface AcquireProspectReservationInput {
  campaignId: string;

  prospectId: string;

  teamId: string;

  overrideId?: string;
}

export interface ReleaseProspectReservationInput {
  campaignId: string;

  prospectId: string;

  teamId: string;

  reservationId: string;
}

export async function listWorkQueue(input: ListWorkQueueInput): Promise<WorkQueueResponse> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  if (input.campaignId) {
    query.set('campaignId', input.campaignId);
  }

  const search = input.q?.trim();

  if (search) {
    query.set('q', search);
  }

  if (input.cursor) {
    query.set('cursor', input.cursor);
  }

  if (input.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  return browserJson<WorkQueueResponse>(`/api/work-queue?${query.toString()}`, {
    method: 'GET',

    cache: 'no-store',
  });
}

export async function getWorkQueueProspectDetail(
  input: GetWorkQueueProspectDetailInput,
): Promise<WorkQueueProspectDetail> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  return browserJson<WorkQueueProspectDetail>(
    `/api/work-queue/${campaignId}/${prospectId}?${query.toString()}`,
    {
      method: 'GET',

      cache: 'no-store',
    },
  );
}

export async function recordProspectActivity(
  input: RecordProspectActivityInput,
): Promise<RecordedProspectActivity> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  return browserJson<RecordedProspectActivity>(
    `/api/work-queue/${campaignId}/${prospectId}/activities` + `?${query.toString()}`,
    {
      method: 'POST',

      headers: {
        'content-type': 'application/json',

        'idempotency-key': input.idempotencyKey,
      },

      body: JSON.stringify({
        type: input.type,
      }),
    },
  );
}

export async function listProspectTimeline(
  input: ListProspectTimelineInput,
): Promise<ProspectTimelinePage> {
  const query = new URLSearchParams();

  /*
   * teamId is required by the Work Queue BFF so it can
   * enforce the same personal-assignment boundary as
   * the Prospect Detail screen.
   */
  query.set('teamId', input.teamId);

  if (input.limit !== undefined) {
    query.set('limit', String(input.limit));
  }

  if (input.cursor) {
    query.set('cursor', input.cursor);
  }

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  return browserJson<ProspectTimelinePage>(
    `/api/work-queue/${campaignId}/${prospectId}/timeline?${query.toString()}`,
    {
      method: 'GET',

      cache: 'no-store',
    },
  );
}

export async function getProspectReservation(
  input: GetProspectReservationInput,
): Promise<ProspectReservationState> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  return browserJson<ProspectReservationState>(
    `/api/work-queue/${campaignId}/${prospectId}/reservation` + `?${query.toString()}`,
    {
      method: 'GET',

      cache: 'no-store',
    },
  );
}

export async function acquireProspectReservation(
  input: AcquireProspectReservationInput,
): Promise<AcquiredProspectReservation> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  const body =
    input.overrideId === undefined
      ? {}
      : {
          overrideId: input.overrideId,
        };

  return browserJson<AcquiredProspectReservation>(
    `/api/work-queue/${campaignId}/${prospectId}/reservation` + `?${query.toString()}`,
    {
      method: 'POST',

      headers: {
        'content-type': 'application/json',
      },

      body: JSON.stringify(body),
    },
  );
}

export async function releaseProspectReservation(
  input: ReleaseProspectReservationInput,
): Promise<ReleasedProspectReservation> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  const reservationId = encodeURIComponent(input.reservationId);

  return browserJson<ReleasedProspectReservation>(
    `/api/work-queue/${campaignId}/${prospectId}` +
      `/reservation/${reservationId}` +
      `?${query.toString()}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getProspectCollisionDecision(
  input: GetProspectCollisionDecisionInput,
): Promise<ProspectCollisionDecision> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);

  const campaignId = encodeURIComponent(input.campaignId);

  const prospectId = encodeURIComponent(input.prospectId);

  return browserJson<ProspectCollisionDecision>(
    `/api/work-queue/${campaignId}/${prospectId}/collision-decision` + `?${query.toString()}`,
    {
      method: 'GET',

      cache: 'no-store',
    },
  );
}
