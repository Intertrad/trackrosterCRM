import {
  DOMAIN_EVENT_TYPES,
  type DomainEventEnvelope,
  type DomainEventType,
} from '@trackroster/types';

export { DOMAIN_EVENT_TYPES };
export type { DomainEventEnvelope, DomainEventType };

const DOMAIN_EVENT_SET = new Set<string>(DOMAIN_EVENT_TYPES);

/**
 * Audit actions are intentionally broader than the product's lifecycle event
 * vocabulary. This adapter keeps the canonical event names typed while still
 * allowing existing audit actions to remain backwards compatible.
 */
export function domainEventTypeFromAuditAction(action: string): DomainEventType | null {
  return DOMAIN_EVENT_SET.has(action) ? (action as DomainEventType) : null;
}

export function isDomainEventType(value: string): value is DomainEventType {
  return DOMAIN_EVENT_SET.has(value);
}
