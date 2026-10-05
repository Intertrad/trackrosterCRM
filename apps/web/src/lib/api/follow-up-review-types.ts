export interface FollowUpReviewSummary {
  id: string;
  followUpId: string;
  campaignId: string;
  prospectId: string;
  establishmentName: string;
  campaignName: string;
  requestedBy: string;
  reason: string;
  previousDueAt: string;
  requestedDueAt: string;
  createdAt: string;
}

export type FollowUpReviewDecision = 'approved' | 'completed' | 'rejected';
