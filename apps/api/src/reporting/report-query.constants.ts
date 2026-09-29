/** Pipeline order, so a funnel never renders alphabetically. */
export const LIFECYCLE_STAGES = [
  'to_contact',
  'contact_made',
  'in_progress',
  'follow_up',
  'qualified',
  'converted',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/*
 * Stage weights for the forecast.
 *
 * A presentation heuristic, not a model: no historical conversion data is
 * recorded anywhere, so this is a straight-line pipeline view and the
 * response says so rather than dressing it up as a prediction.
 */
export const STAGE_WEIGHTS: Record<LifecycleStage, number> = {
  to_contact: 0.05,
  contact_made: 0.15,
  in_progress: 0.3,
  follow_up: 0.45,
  qualified: 0.7,
  converted: 1,
};
