import { browserJson } from './browser-json';
import type {
  ProspectTimelinePage,
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
