import { browserJson } from './browser-json';
import type { WorkQueueResponse } from './work-queue-types';

export interface ListWorkQueueInput {
  teamId: string;

  campaignId?: string;

  q?: string;

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
