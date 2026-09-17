import type {
  FollowUpQueueItem,
  ProspectFollowUp,
  ProspectFollowUpStatus,
} from '@/lib/api/follow-up-types';
import type { WorkQueueProspectDetail } from '@/lib/api/work-queue-types';

import { authenticatedBackendJson } from './authenticated-backend-json';

export interface BackendProspectFollowUp {
  id: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignedUserId: string | null;

  createdBy: string;

  dueAt: string;

  status: ProspectFollowUpStatus;

  completedAt: string | null;

  cancelledAt: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface BackendProspectFollowUpListResponse {
  items: BackendProspectFollowUp[];
}

export interface BackendFollowUpQueueItem extends BackendProspectFollowUp {
  campaignName: string;

  establishmentName: string;
}

export interface BackendFollowUpQueueResponse {
  items: BackendFollowUpQueueItem[];
}

export function toBrowserProspectFollowUp(followUp: BackendProspectFollowUp): ProspectFollowUp {
  return {
    id: followUp.id,

    campaignId: followUp.campaignId,

    prospectId: followUp.campaignProspectId,

    establishmentId: followUp.establishmentId,

    dueAt: followUp.dueAt,

    status: followUp.status,

    ownership: followUp.assignedUserId === null ? 'team' : 'user',

    completedAt: followUp.completedAt,

    cancelledAt: followUp.cancelledAt,

    createdAt: followUp.createdAt,

    updatedAt: followUp.updatedAt,
  };
}

export function toBrowserFollowUpQueueItem(followUp: BackendFollowUpQueueItem): FollowUpQueueItem {
  return {
    ...toBrowserProspectFollowUp(followUp),

    campaignName: followUp.campaignName,

    establishmentName: followUp.establishmentName,
  };
}

export function buildProspectFollowUpsPath(campaignId: string, prospectId: string): string {
  return (
    `/campaigns/${encodeURIComponent(campaignId)}` +
    `/prospects/${encodeURIComponent(prospectId)}` +
    '/follow-ups'
  );
}

export function buildFollowUpActionPath(
  campaignId: string,
  prospectId: string,
  followUpId: string,
  action: 'reschedule' | 'complete' | 'cancel',
): string {
  return (
    buildProspectFollowUpsPath(campaignId, prospectId) +
    `/${encodeURIComponent(followUpId)}` +
    `/${action}`
  );
}

export function getIdempotencyHeaders(request: Request): Record<string, string> {
  const idempotencyKey = request.headers.get('idempotency-key');

  const headers: Record<string, string> = {};

  /*
   * Never create or replace idempotency keys here.
   *
   * The browser owns the logical mutation attempt.
   * The BFF must forward that exact key unchanged.
   *
   * If absent, omit it so Nest returns its
   * canonical idempotency error.
   */
  if (idempotencyKey !== null) {
    headers['idempotency-key'] = idempotencyKey;
  }

  return headers;
}

export async function requireWorkQueueProspect(
  request: Request,
  campaignId: string,
  prospectId: string,
): Promise<boolean | null> {
  const requestUrl = new URL(request.url);

  const teamId = requestUrl.searchParams.get('teamId');

  const query = new URLSearchParams();

  /*
   * teamId is browser-selected workspace context,
   * not trusted authorization context.
   *
   * Nest Work Queue authorization validates that
   * the authenticated user actually owns the
   * requested Prospector team scope.
   */
  if (teamId !== null) {
    query.set('teamId', teamId);
  }

  const encodedCampaignId = encodeURIComponent(campaignId);

  const encodedProspectId = encodeURIComponent(prospectId);

  const basePath = `/work-queue/${encodedCampaignId}` + `/${encodedProspectId}`;

  const queryString = query.toString();

  const detail = await authenticatedBackendJson<WorkQueueProspectDetail>(
    queryString ? `${basePath}?${queryString}` : basePath,
  );

  if (!detail) {
    return null;
  }

  return true;
}
