import { browserJson } from './browser-json';

import type { ProspectorTodayResponse } from './prospector-today-types';

export interface GetProspectorTodayInput {
  teamId: string;

  timeZone: string;

  signal?: AbortSignal;
}

export async function getProspectorToday(
  input: GetProspectorTodayInput,
): Promise<ProspectorTodayResponse> {
  const query = new URLSearchParams();

  query.set('teamId', input.teamId);
  query.set('timeZone', input.timeZone);

  return browserJson<ProspectorTodayResponse>(`/api/prospector/today?${query.toString()}`, {
    method: 'GET',

    cache: 'no-store',

    signal: input.signal,
  });
}
