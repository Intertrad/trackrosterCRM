import type { ProspectActivity } from '../database/schema/prospect-activities.js';

export interface CoolingOffEvaluation {
  active: boolean;

  activity: ProspectActivity | null;

  expiresAt: Date | null;
}
