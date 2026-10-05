import { browserJson } from './browser-json';
import type { FollowUpReviewDecision, FollowUpReviewSummary } from './follow-up-review-types';

export function requestFollowUpReview(input: {
  campaignId: string;
  prospectId: string;
  followUpId: string;
  dueAt: string;
  reason: string;
  idempotencyKey: string;
}): Promise<FollowUpReviewSummary> {
  return browserJson<FollowUpReviewSummary>(
    `/api/campaigns/${encodeURIComponent(input.campaignId)}/prospects/${encodeURIComponent(input.prospectId)}/follow-ups/${encodeURIComponent(input.followUpId)}/reschedule-review`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': input.idempotencyKey,
      },
      body: JSON.stringify({ dueAt: input.dueAt, reason: input.reason }),
    },
  );
}

export function listFollowUpReviews(signal?: AbortSignal): Promise<FollowUpReviewSummary[]> {
  return browserJson<FollowUpReviewSummary[]>('/api/follow-up-reviews', {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
}

export function decideFollowUpReview(input: {
  reviewId: string;
  decision: FollowUpReviewDecision;
  reason: string;
}): Promise<{ id: string; decision: FollowUpReviewDecision; followUpId: string }> {
  return browserJson(`/api/follow-up-reviews/${encodeURIComponent(input.reviewId)}/decision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify({ decision: input.decision, reason: input.reason }),
  });
}
