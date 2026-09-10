import type { CollisionOverrideReason } from '../database/schema/collision-overrides.js';
import type { CollisionDecisionResult, CollisionReasonCode } from './collision.types.js';

export function isOverrideableCollisionReason(
  reasonCode: CollisionReasonCode,
): reasonCode is CollisionOverrideReason {
  return (
    reasonCode === 'PLANNED_ACTION' ||
    reasonCode === 'RECENT_CONTACT' ||
    reasonCode === 'ACTIVE_ASSIGNMENT'
  );
}

/*
 * Build a deterministic identity for the exact
 * collision that a manager approved.
 *
 * The same function will later be used during
 * reservation acquisition.
 *
 * If the underlying collision changes, the key
 * changes and the old override becomes stale.
 */
export function buildCollisionOverrideConflictKey(result: CollisionDecisionResult): string {
  if (!result.conflict) {
    throw new Error('Cannot build override key without collision conflict');
  }

  switch (result.reasonCode) {
    case 'PLANNED_ACTION': {
      if (!('followUpId' in result.conflict) || !('dueAt' in result.conflict)) {
        throw new Error('PLANNED_ACTION collision has invalid conflict shape');
      }

      return ['planned_action', result.conflict.followUpId, result.conflict.dueAt].join(':');
    }

    case 'RECENT_CONTACT': {
      if (!('activityId' in result.conflict) || !('expiresAt' in result.conflict)) {
        throw new Error('RECENT_CONTACT collision has invalid conflict shape');
      }

      return ['recent_contact', result.conflict.activityId, result.conflict.expiresAt].join(':');
    }

    case 'ACTIVE_ASSIGNMENT': {
      if (!('assignmentId' in result.conflict) || !('assignedAt' in result.conflict)) {
        throw new Error('ACTIVE_ASSIGNMENT collision has invalid conflict shape');
      }

      return ['active_assignment', result.conflict.assignmentId, result.conflict.assignedAt].join(
        ':',
      );
    }

    default:
      throw new Error(`Collision ${result.reasonCode} is not overrideable`);
  }
}
