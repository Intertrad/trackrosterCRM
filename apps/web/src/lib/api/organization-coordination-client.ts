import { browserJson } from './browser-json';

export type CoordinationPolicy = {
  id: string;
  organizationAId: string;
  organizationBId: string;
  policy: 'shared' | 'coordinated' | 'delayed' | 'independent';
  delayMinutes: number | null;
};

export function listCoordinationPolicies(signal?: AbortSignal): Promise<CoordinationPolicy[]> {
  return browserJson<CoordinationPolicy[]>('/api/organization-coordination-policies', {
    cache: 'no-store',
    signal,
  });
}
export function createCoordinationPolicy(
  input: Omit<CoordinationPolicy, 'id'>,
): Promise<CoordinationPolicy> {
  return browserJson<CoordinationPolicy>('/api/organization-coordination-policies', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}
export function updateCoordinationPolicy(
  id: string,
  input: Pick<CoordinationPolicy, 'policy' | 'delayMinutes'>,
): Promise<CoordinationPolicy> {
  return browserJson<CoordinationPolicy>(
    `/api/organization-coordination-policies/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify(input),
    },
  );
}
export function deleteCoordinationPolicy(id: string): Promise<{ deleted: boolean }> {
  return browserJson<{ deleted: boolean }>(
    `/api/organization-coordination-policies/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { 'idempotency-key': crypto.randomUUID() } },
  );
}
