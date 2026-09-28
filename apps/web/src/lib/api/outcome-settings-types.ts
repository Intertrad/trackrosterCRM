import type { ActionLifecycleStage } from './action-types';

/**
 * One outcome a tenant has configured.
 *
 * `code` is what gets recorded, `label` is the tenant's own wording for it, and
 * `actionTypes` are the channels it applies to — "no answer" belongs to a call, not
 * to an e-mail. `enabled` is how a tenant retires an outcome without losing the
 * history recorded against it, so a disabled one must never be offered.
 */
export interface OutcomeDefinition {
  code: string;
  label: string;
  behavior: string;
  enabled: boolean;
  actionTypes: string[];
}

/** `GET /settings/default-statuses`. */
export interface OutcomeSettings {
  outcomes: OutcomeDefinition[];
  lifecycleStages: ActionLifecycleStage[];
  etag?: string;
}

/**
 * The outcomes offerable for one channel.
 *
 * Disabled outcomes are dropped, and an outcome that names no channel at all is
 * treated as applying to every one — that is how the API's own defaults are shaped,
 * and dropping them would leave a tenant with an empty list.
 */
export function outcomesForChannel(
  outcomes: OutcomeDefinition[],
  channel: string,
): OutcomeDefinition[] {
  return outcomes.filter(
    (outcome) =>
      outcome.enabled &&
      (outcome.actionTypes.length === 0 || outcome.actionTypes.includes(channel)),
  );
}
