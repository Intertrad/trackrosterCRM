import type { WorkQueueLifecycleStage } from '@/lib/api/work-queue-types';

export type LifecycleStageKey = WorkQueueLifecycleStage;
import { cn } from '@/lib/ui/cn';

/*
 * The lifecycle colours double as the map legend, so the palette lives here
 * and every screen reads it rather than restating hex values.
 */
export const LIFECYCLE_STYLES = {
  to_contact: { label: 'To contact', dot: 'bg-brand', chip: 'bg-brand-tint text-brand' },
  contact_made: {
    label: 'Contact made',
    dot: 'bg-brand-mid',
    chip: 'bg-brand-tint text-brand',
  },
  in_progress: {
    label: 'In progress',
    dot: 'bg-brand-mid',
    chip: 'bg-brand-tint text-brand',
  },
  follow_up: { label: 'Follow-up', dot: 'bg-warning', chip: 'bg-warning-bg text-warning' },
  qualified: { label: 'Qualified', dot: 'bg-lime-deep', chip: 'bg-success-bg text-success' },
  converted: { label: 'Converted', dot: 'bg-success', chip: 'bg-success-bg text-success' },
} as const satisfies Record<WorkQueueLifecycleStage, { label: string; dot: string; chip: string }>;

export const LIFECYCLE_ORDER: WorkQueueLifecycleStage[] = [
  'to_contact',
  'contact_made',
  'in_progress',
  'follow_up',
  'qualified',
  'converted',
];

export function getLifecycleLabel(stage: WorkQueueLifecycleStage): string {
  return LIFECYCLE_STYLES[stage].label;
}

export function LifecycleBadge({
  stage,
  className,
}: {
  stage: WorkQueueLifecycleStage;
  className?: string;
}) {
  const style = LIFECYCLE_STYLES[stage];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold',
        style.chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

export function LifecycleDot({ stage }: { stage: WorkQueueLifecycleStage }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0 rounded-full', LIFECYCLE_STYLES[stage].dot)}
    />
  );
}
