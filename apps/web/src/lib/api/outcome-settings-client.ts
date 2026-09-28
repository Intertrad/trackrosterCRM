import { browserJson } from './browser-json';
import type { OutcomeSettings } from './outcome-settings-types';

/**
 * The tenant's configured outcomes.
 *
 * Fetched rather than hardcoded: a tenant renames and retires these, and a fixed
 * frontend list would offer outcomes nobody uses and hide the ones they added.
 */
export function getOutcomeSettings(signal?: AbortSignal): Promise<OutcomeSettings> {
  return browserJson<OutcomeSettings>('/api/settings/default-statuses', {
    cache: 'no-store',
    signal,
  });
}
